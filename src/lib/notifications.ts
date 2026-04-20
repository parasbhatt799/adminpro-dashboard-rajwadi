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
      return; // Push not enabled or settings missing
    }

    if (!settings.app_id || !settings.rest_api_key) {
      console.warn('OneSignal credentials missing in settings.');
      return;
    }

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

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Push Notification Error:', errorData.error);
    }
  } catch (err) {
    console.error('Failed to trigger push notification:', err);
  }
}
