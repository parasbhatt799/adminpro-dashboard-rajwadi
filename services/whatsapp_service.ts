import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';

let client: any = null;
let qrCodeDataUrl: string | null = null;
let isConnected = false;
let isInitializing = false;
let connectedPhone: string | null = null;
let lastQrTimestamp: string | null = null;

// Initialize WhatsApp Client
export const initWhatsApp = () => {
  if (client || isInitializing) return;
  isInitializing = true;
  console.log('[WhatsApp] Initializing self-hosted WhatsApp Web client...');

  try {
    client = new Client({
      authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    client.on('qr', async (qr: string) => {
      console.log('[WhatsApp] New QR code generated. Scan in B2B Admin Panel.');
      try {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
        lastQrTimestamp = new Date().toISOString();
        isConnected = false;
      } catch (err) {
        console.error('[WhatsApp] Failed to generate QR data URL:', err);
      }
    });

    client.on('ready', () => {
      console.log('[WhatsApp] Client is Ready & Connected!');
      isConnected = true;
      isInitializing = false;
      qrCodeDataUrl = null;
      try {
        if (client.info && client.info.wid) {
          connectedPhone = client.info.wid.user;
        }
      } catch (err) {
        console.error('[WhatsApp] Could not get phone info:', err);
      }
    });

    client.on('authenticated', () => {
      console.log('[WhatsApp] Client authenticated successfully.');
      isInitializing = false;
    });

    client.on('auth_failure', (msg: string) => {
      console.error('[WhatsApp] Authentication failure:', msg);
      isConnected = false;
      isInitializing = false;
    });

    client.on('disconnected', (reason: string) => {
      console.log('[WhatsApp] Client disconnected:', reason);
      isConnected = false;
      isInitializing = false;
      qrCodeDataUrl = null;
      connectedPhone = null;
    });

    client.initialize().catch((err: any) => {
      console.error('[WhatsApp] Initialization error:', err);
      isInitializing = false;
    });
  } catch (err) {
    console.error('[WhatsApp] Unexpected error during init:', err);
    isInitializing = false;
  }
};

// Return current WhatsApp status
export const getWhatsAppStatus = () => {
  return {
    isConnected,
    isInitializing,
    qrCodeDataUrl,
    connectedPhone,
    lastQrTimestamp
  };
};

// Restart / Re-init WhatsApp
export const restartWhatsApp = async () => {
  console.log('[WhatsApp] Restarting WhatsApp client...');
  try {
    if (client) {
      await client.destroy().catch(() => {});
      client = null;
    }
  } catch (err) {
    console.error('[WhatsApp] Error destroying existing client:', err);
  } finally {
    client = null;
    isConnected = false;
    isInitializing = false;
    qrCodeDataUrl = null;
    connectedPhone = null;
    initWhatsApp();
  }
};

// Send direct WhatsApp text message to any phone number
export const sendWhatsAppMessage = async (mobileNumber: string, message: string): Promise<boolean> => {
  if (!isConnected || !client) {
    console.warn('[WhatsApp] Cannot send message: Client is not connected.');
    return false;
  }

  try {
    // Sanitize mobile number to international standard (India prefix 91 if not present)
    const cleanNumber = mobileNumber.replace(/\D/g, '');
    if (!cleanNumber) {
      console.error('[WhatsApp] Invalid phone number provided:', mobileNumber);
      return false;
    }

    const formattedNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
    const chatId = `${formattedNumber}@c.us`;

    console.log(`[WhatsApp] Sending message to ${chatId}...`);
    await client.sendMessage(chatId, message);
    console.log(`[WhatsApp] Message sent successfully to ${chatId}`);
    return true;
  } catch (err) {
    console.error('[WhatsApp] Error sending message:', err);
    return false;
  }
};

// Helper 1: Notify Admin on New B2B Fund Request
export const notifyAdminNewB2BFundRequest = async (data: {
  agentName: string;
  agentPhone: string;
  amount: number;
  utr: string;
  mode: string;
  proofUrl?: string;
  adminPhone?: string;
}) => {
  const adminMobile = data.adminPhone || process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_MOBILE || '9876543210';
  
  let message = `📥 *NEW B2B FUND REQUEST*\n\n` +
    `👤 *Agent Name:* ${data.agentName}\n` +
    `📞 *Agent Phone:* ${data.agentPhone}\n` +
    `💰 *Amount:* ₹${Number(data.amount).toLocaleString('en-IN')}\n` +
    `🏦 *Payment Mode:* ${data.mode || 'Bank Transfer'}\n` +
    `🔢 *UTR / Ref:* ${data.utr}\n` +
    `🕒 *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`;

  if (data.proofUrl) {
    message += `📷 *Proof Link:* ${data.proofUrl}\n\n`;
  } else {
    message += `\n`;
  }
  message += `Please log in to the B2B Admin Panel to approve or reject this request.`;

  if (!isConnected || !client) {
    console.warn('[WhatsApp] Cannot send admin notification: Client is not connected.');
    return false;
  }

  try {
    const cleanNumber = adminMobile.replace(/\D/g, '');
    const formattedNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
    const chatId = `${formattedNumber}@c.us`;

    // If proof image URL is available, send proof image directly with caption!
    if (data.proofUrl && typeof data.proofUrl === 'string' && data.proofUrl.startsWith('http')) {
      try {
        console.log(`[WhatsApp] Fetching proof image from ${data.proofUrl}...`);
        const media = await MessageMedia.fromUrl(data.proofUrl, { unsafeMime: true });
        await client.sendMessage(chatId, media, { caption: message });
        console.log(`[WhatsApp] Sent fund request message with proof image photo to ${chatId}`);
        return true;
      } catch (mediaErr) {
        console.error('[WhatsApp] Failed to fetch/send proof image, sending text fallback:', mediaErr);
      }
    }

    return await sendWhatsAppMessage(adminMobile, message);
  } catch (err) {
    console.error('[WhatsApp] Error in notifyAdminNewB2BFundRequest:', err);
    return false;
  }
};

// Helper 2: Notify Agent when B2B Fund Request is Approved
export const notifyAgentFundRequestApproved = async (data: {
  agentName: string;
  agentPhone: string;
  amount: number;
  utr: string;
  updatedBalance: number;
}) => {
  const message = `🎉 *B2B FUND REQUEST APPROVED!*\n\n` +
    `Dear ${data.agentName},\n\n` +
    `Your fund request of *₹${Number(data.amount).toLocaleString('en-IN')}* has been successfully approved and credited to your main wallet.\n\n` +
    `🔢 *UTR / Ref:* ${data.utr}\n` +
    `💼 *Updated Wallet Balance:* ₹${Number(data.updatedBalance).toLocaleString('en-IN')}\n` +
    `🕒 *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
    `Thank you for using B2B Services!`;

  return await sendWhatsAppMessage(data.agentPhone, message);
};

// Helper 3: Notify Agent when B2B Fund Request is Rejected
export const notifyAgentFundRequestRejected = async (data: {
  agentName: string;
  agentPhone: string;
  amount: number;
  utr: string;
  reason?: string;
}) => {
  const message = `❌ *B2B FUND REQUEST REJECTED*\n\n` +
    `Dear ${data.agentName},\n\n` +
    `Your fund request of *₹${Number(data.amount).toLocaleString('en-IN')}* (UTR: ${data.utr}) has been rejected by admin.\n\n` +
    `📌 *Reason:* ${data.reason || 'Verification Failed / Invalid UTR'}\n` +
    `🕒 *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
    `If you believe this is an error, please contact admin support.`;

  return await sendWhatsAppMessage(data.agentPhone, message);
};
