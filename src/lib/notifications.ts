import { supabase } from './supabase';

/**
 * Utility to send push notifications to the Admin via OneSignal
 */
export async function sendAdminPushNotification(title: string, message: string) {
  try {
    // 1. Fetch OneSignal Settings
    const { data: settings, error: sError } = await supabase
      .from('onesignal_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (sError || !settings || !settings.is_enabled) {
      console.warn('[Push] Notification skipped: Settings not found or disabled.', sError);
      return;
    }

    if (!settings.app_id || !settings.rest_api_key) {
      console.warn('[Push] Notification skipped: Missing API Keys in database.');
      return;
    }

    console.log('[Push] Triggering notification for:', title);

    // 2. Call the serverless API
    const response = await fetch('/api/send-push-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        message,
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
