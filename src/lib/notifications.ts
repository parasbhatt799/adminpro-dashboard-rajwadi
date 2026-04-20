import { supabase } from './supabase';

/**
 * Trigger a push notification to all subscribed admins.
 * This calls our backend API which then interacts with OneSignal.
 */
export async function sendAdminPushNotification(title: string, message: string) {
  try {
    // 1. Fetch OneSignal Credentials from DB
    const { data: settings, error: sError } = await supabase
      .from('onesignal_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (sError || !settings || !settings.is_enabled) {
      console.warn('[Push] Notification skipped: Settings not found or disabled.');
      return;
    }

    if (!settings.app_id || !settings.rest_api_key) {
      console.warn('[Push] Notification skipped: Missing API Keys in database.');
      return;
    }

    // 2. Fetch all subscribed admins
    const { data: admins, error: aError } = await supabase
      .from('users_profiles')
      .select('onesignal_id')
      .not('onesignal_id', 'is', null);

    if (aError || !admins || admins.length === 0) {
      console.warn('[Push] No subscribed devices found.');
      return;
    }

    const targetIds = admins.map(a => a.onesignal_id).filter(Boolean);

    console.log('[Push] Triggering notification for:', title, 'to', targetIds.length, 'devices');

    // 3. Call our backend API
    const response = await fetch('/api/send-push-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        message,
        player_ids: targetIds, // Pass specific IDs for targeted delivery
        credentials: {
          app_id: settings.app_id,
          rest_api_key: settings.rest_api_key
        }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('[Push] API Error:', result.error);
    } else {
      console.log('[Push] Success! Notification ID:', result.id);
    }
  } catch (err) {
    console.error('[Push] Critical Failure:', err);
  }
}
