import https from 'https';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, message, player_ids, credentials } = req.body;

  if (!title || !message || !credentials?.app_id || !credentials?.rest_api_key) {
    return res.status(400).json({ error: "Title, message, and OneSignal credentials are required." });
  }

  try {
    const { app_id, rest_api_key } = credentials;
    const data: any = {
      app_id: app_id.trim(),
      headings: { en: title },
      contents: { en: message },
      isAnyWeb: true,
      web_url: "https://www.usepay.in/admin",
    };

    // Target specific players if provided, otherwise fallback to segments
    if (player_ids && player_ids.length > 0) {
      data.include_player_ids = player_ids;
    } else {
      data.included_segments = ["Subscribed Users", "All"];
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
