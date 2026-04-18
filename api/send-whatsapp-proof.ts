/**
 * WhatsApp Business API - Send Proof Handler
 * This API is called by the admin panel to send a screenshot link via WhatsApp.
 */

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { whatsapp_number, proof_url, credentials } = req.body;

  if (!whatsapp_number || !proof_url) {
    return res.status(400).json({ error: 'WhatsApp number and proof URL are required.' });
  }

  if (!credentials || !credentials.access_token || !credentials.phone_number_id) {
    return res.status(400).json({ error: 'WhatsApp API credentials missing.' });
  }

  try {
    const { access_token, phone_number_id, sender_number } = credentials;

    // Meta Graph API Endpoint for WhatsApp Messages
    const url = `https://graph.facebook.com/v18.0/${phone_number_id}/messages`;

    // 1. Send the proof image
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: whatsapp_number,
        type: "image",
        image: {
          link: proof_url,
          caption: `Payment Approved! Here is the proof of your submission. (Sent from ${sender_number || 'Admin Portal'})`
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Meta WhatsApp API Error:', data);
      throw new Error(data.error?.message || 'Failed to send WhatsApp message');
    }

    return res.status(200).json({ 
      success: true, 
      message_id: data.messages?.[0]?.id 
    });

  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    return res.status(500).json({ error: error.message });
  }
}
