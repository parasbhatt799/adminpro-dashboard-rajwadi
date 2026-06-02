import https from 'https';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, message, player_ids, target, link, credentials, external_user_ids } = req.body;

  // Log incoming request data for debugging
  console.log(`[Push API] Request - Title: ${title}, Target: ${target}, Link: ${link}`);

  if (!title || !message || !credentials?.app_id || !credentials?.rest_api_key) {
    return res.status(400).json({ error: "Title, message, and OneSignal credentials are required." });
  }

  try {
    const { app_id, rest_api_key } = credentials;
    let targetPlayerIds = player_ids || [];
    let externalUserIds = external_user_ids || [];

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // --- Server-side discovery of Admin Player IDs ---
    if (target === 'admins') {
      const { data: admins, error } = await supabaseAdmin
        .from('admin_profiles')
        .select('mobile_number, onesignal_id');

      if (!error && admins) {
        const discoveredIds = admins.map(a => a.onesignal_id).filter(Boolean);
        targetPlayerIds = [...new Set([...targetPlayerIds, ...discoveredIds])];

        const discoveredExternalIds = admins.map(a => a.mobile_number).filter(Boolean);
        externalUserIds = [...new Set([...externalUserIds, ...discoveredExternalIds])];
      }
      
      console.log(`[Push API] Target mode: admins. Found ${targetPlayerIds.length} device IDs.`);
    }

    // --- Resolve onesignal_ids from DB for all externalUserIds ---
    if (externalUserIds.length > 0) {
      // Query users_profiles for regular users
      const { data: userProfiles } = await supabaseAdmin
        .from('users_profiles')
        .select('onesignal_id')
        .in('id', externalUserIds.map((id: any) => String(id)));

      // Query admin_profiles for admins (using mobile_number)
      const { data: adminProfiles } = await supabaseAdmin
        .from('admin_profiles')
        .select('onesignal_id')
        .in('mobile_number', externalUserIds.map((id: any) => String(id)));

      const freshPlayerIds: string[] = [];
      if (userProfiles) {
        freshPlayerIds.push(...userProfiles.map(p => p.onesignal_id).filter(Boolean));
      }
      if (adminProfiles) {
        freshPlayerIds.push(...adminProfiles.map(p => p.onesignal_id).filter(Boolean));
      }

      if (freshPlayerIds.length > 0) {
        targetPlayerIds = [...new Set([...targetPlayerIds, ...freshPlayerIds])];
      }
    }

    const data: any = {
      app_id: app_id.trim(),
      headings: { en: title },
      contents: { en: message },
      isAnyWeb: true,
      // Fix: Ensure link starts with a slash and no double slashes
      web_url: link ? `https://www.usepay.in/${link.replace(/^\//, '')}` : "https://www.usepay.in/dashboard",
    };

    // Target specific players if provided, otherwise fallback to segments or fail
    const cleanPlayerIds = targetPlayerIds.filter((id: any) => id && typeof id === 'string');
    const cleanExternalIds = externalUserIds.filter((id: any) => id && (typeof id === 'string' || typeof id === 'number'));

    const hasValidTarget = cleanPlayerIds.length > 0 || cleanExternalIds.length > 0;

    if (hasValidTarget) {
      if (cleanPlayerIds.length > 0) {
        data.include_player_ids = cleanPlayerIds;
        data.include_subscription_ids = cleanPlayerIds;
      }
      if (cleanExternalIds.length > 0) {
        data.include_external_user_ids = cleanExternalIds.map((id: any) => String(id));
      }
    } else if (target === 'all' || target === 'broadcast') {
      data.included_segments = ["Subscribed Users", "All"];
    } else {
      console.warn('[Push] Target resolution failed for:', title);
      return res.status(400).json({ error: "No valid target found. Notification blocked for privacy." });
    }

    const bodyData = JSON.stringify(data);

    const options = {
      hostname: 'onesignal.com',
      path: '/api/v1/notifications',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${rest_api_key.trim()}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData)
      }
    };

    return new Promise((resolve) => {
      const osRequest = https.request(options, (osRes) => {
        let responseBody = '';
        osRes.on('data', (chunk) => responseBody += chunk);
        osRes.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            if (osRes.statusCode && osRes.statusCode >= 200 && osRes.statusCode < 300) {
              res.status(200).json({ success: true, id: parsed.id });
            } else {
              res.status(osRes.statusCode || 500).json({ 
                error: parsed.errors?.[0] || "OneSignal API Error",
                details: parsed.errors
              });
            }
          } catch (e: any) {
            res.status(500).json({ error: "Invalid response from OneSignal" });
          }
          resolve(true);
        });
      });

      osRequest.on('error', (err) => {
        res.status(500).json({ error: err.message });
        resolve(true);
      });

      osRequest.write(bodyData);
      osRequest.end();
    });

  } catch (error: any) {
    console.error('[OneSignal Vercel] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
