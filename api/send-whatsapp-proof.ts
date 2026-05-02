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

  if (!credentials) {
    return res.status(400).json({ error: 'WhatsApp API credentials missing.' });
  }

  try {
    const { 
      provider = 'meta',
      access_token, 
      phone_number_id, 
      sender_number,
      aisensy_api_key,
      aisensy_campaign_name
    } = credentials;

    if (provider === 'meta') {
      if (!access_token || !phone_number_id) {
        throw new Error('Meta API credentials missing (Access Token or Phone Number ID)');
      }

      // Meta Graph API Endpoint for WhatsApp Messages
      const url = `https://graph.facebook.com/v18.0/${phone_number_id}/messages`;

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
        throw new Error(data.error?.message || 'Failed to send WhatsApp message via Meta');
      }

      return res.status(200).json({ success: true, message_id: data.messages?.[0]?.id });

    } else if (provider === 'aisensy') {
      if (!aisensy_api_key || !aisensy_campaign_name) {
        throw new Error('AiSensy API credentials missing (API Key or Campaign Name)');
      }

<<<<<<< HEAD
      // AiSensy Campaign API Endpoint (Updated to /t1/ as per user's working curl)
=======
      // AiSensy Campaign API Endpoint
>>>>>>> 73098f6a3f5c92a1f6251ca3f7def83f15928526
      const url = `https://backend.aisensy.com/campaign/t1/api/v2`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: aisensy_api_key,
          campaignName: aisensy_campaign_name,
          destination: whatsapp_number,
<<<<<<< HEAD
          userName: "User", 
          templateParams: [],
=======
          userName: "User", // Default fallback
          templateParams: [], // Add params if needed
>>>>>>> 73098f6a3f5c92a1f6251ca3f7def83f15928526
          source: "UsePay App",
          media: {
            url: proof_url,
            filename: "payment_proof.png"
          },
          buttons: [],
          carouselCards: [],
          location: {},
          attributes: {},
          paramsFallbackValue: {}
        })
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        console.error('AiSensy API Error:', data);
        throw new Error(data.message || 'Failed to send WhatsApp message via AiSensy');
      }

      return res.status(200).json({ success: true, message_id: data.uuid });
    } else {
      throw new Error('Unsupported WhatsApp provider: ' + provider);
    }

  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    return res.status(500).json({ error: error.message });
  }
}
