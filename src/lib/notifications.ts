/**
 * Trigger a push notification to all subscribed admins.
 * This calls our backend API which then interacts with OneSignal.
 */
export async function sendAdminPushNotification(title: string, message: string, link?: string) {
  try {
    // Call our backend API directly with target: 'admins' (credentials fetched server-side)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('/api/send-push-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        title,
        message,
        target: 'admins',
        link, // e.g. '/qr-payment-requests'
      })
    });
    clearTimeout(timeoutId);

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
