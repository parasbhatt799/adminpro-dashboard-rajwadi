/**
 * OneSignal Push Notification API Handler
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, message, credentials } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required.' });
  }

  if (!credentials || !credentials.app_id || !credentials.rest_api_key) {
    return res.status(400).json({ error: 'OneSignal API credentials missing.' });
  }

  try {
    const { app_id, rest_api_key } = credentials;

    // OneSignal REST API Endpoint
    const url = 'https://onesignal.com/api/v1/notifications';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${rest_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: app_id,
        headings: { en: title },
        contents: { en: message },
        included_segments: ["Subscribed Users"], // You can also use specific tags like { "field": "tag", "key": "role", "relation": "=", "value": "admin" }
        isAnyWeb: true,
        web_url: "https://www.usepay.in/admin" // Link to open when clicked
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OneSignal API Error:', data);
      throw new Error(data.errors?.[0] || 'Failed to send push notification');
    }

    return res.status(200).json({ 
      success: true, 
      id: data.id 
    });

  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return res.status(500).json({ error: error.message });
  }
}
