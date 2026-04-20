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

    // 2. Call our backend API with target: 'admins'
    // We no longer fetch IDs on the client to avoid RLS security blocks
    const response = await fetch('/api/send-push-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        message,
        target: 'admins', // Tell the server to find the admins
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
