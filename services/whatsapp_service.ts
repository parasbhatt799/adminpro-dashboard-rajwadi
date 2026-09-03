import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';

let client: any = null;
let qrCodeDataUrl: string | null = null;
let isConnected = false;
let isInitializing = false;
let connectedPhone: string | null = null;
let lastQrTimestamp: string | null = null;
let configuredAdminNumbers: string = '';

const CONFIG_FILE = path.join(process.cwd(), '.whatsapp_config.json');

// Load saved Admin WhatsApp numbers from local config or env
export const loadConfiguredAdminNumbers = (): string => {
  if (configuredAdminNumbers) return configuredAdminNumbers;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (data && data.adminNumbers) {
        configuredAdminNumbers = data.adminNumbers;
        return configuredAdminNumbers;
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Error loading local config file:', err);
  }
  return configuredAdminNumbers || process.env.ADMIN_WHATSAPP_NUMBERS || process.env.ADMIN_WHATSAPP_NUMBER || '';
};

// Save Admin WhatsApp numbers dynamically
export const setAdminWhatsAppNumbers = (numbers: string) => {
  configuredAdminNumbers = numbers;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ adminNumbers: numbers, updatedAt: new Date().toISOString() }, null, 2));
    console.log('[WhatsApp] Saved admin WhatsApp numbers to local config:', numbers);
  } catch (err) {
    console.error('[WhatsApp] Error writing local config file:', err);
  }
};

const getChromiumExecutablePath = (): string | undefined => {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || process.env.CHROMIUM_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidatePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return undefined;
};

let lastInitError: string | null = null;
let initTimeoutTimer: NodeJS.Timeout | null = null;

// Initialize WhatsApp Client
export const initWhatsApp = () => {
  if (client) {
    if (!isConnected && !qrCodeDataUrl && !isInitializing) {
      console.log('[WhatsApp] Client exists but missing QR. Re-initializing...');
    } else {
      return;
    }
  }

  isInitializing = true;
  lastInitError = null;
  console.log('[WhatsApp] Initializing self-hosted WhatsApp Web client...');

  try {
    const execPath = getChromiumExecutablePath();
    console.log(`[WhatsApp] Launching Puppeteer using ${execPath ? execPath : 'default bundled Chromium'}`);

    const puppeteerOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--ignore-certificate-errors'
      ]
    };

    if (execPath) {
      puppeteerOptions.executablePath = execPath;
    }

    const clientConfig: any = {
      authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
      puppeteer: puppeteerOptions
    };

    // Try applying webVersionCache with safety
    try {
      clientConfig.webVersionCache = {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
      };
    } catch (_) {}

    client = new Client(clientConfig);

    if (initTimeoutTimer) clearTimeout(initTimeoutTimer);
    initTimeoutTimer = setTimeout(() => {
      if (!isConnected && !qrCodeDataUrl && isInitializing) {
        console.warn('[WhatsApp] Init timeout reached (35s) without QR. Resetting initialization state...');
        isInitializing = false;
        lastInitError = 'Initialization timeout reached (35s). Click Force Generate QR Code.';
      }
    }, 35000);

    client.on('qr', async (qr: string) => {
      console.log('[WhatsApp] New QR code generated. Scan in B2B Admin Panel.');
      if (initTimeoutTimer) clearTimeout(initTimeoutTimer);
      try {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
        lastQrTimestamp = new Date().toISOString();
        isConnected = false;
        isInitializing = false;
        lastInitError = null;
      } catch (err: any) {
        console.error('[WhatsApp] Failed to generate QR data URL:', err);
        lastInitError = err?.message || 'Failed to render QR Code';
      }
    });

    client.on('ready', () => {
      console.log('[WhatsApp] Client is Ready & Connected!');
      if (initTimeoutTimer) clearTimeout(initTimeoutTimer);
      isConnected = true;
      isInitializing = false;
      qrCodeDataUrl = null;
      lastInitError = null;
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
      lastInitError = null;
    });

    client.on('auth_failure', (msg: string) => {
      console.error('[WhatsApp] Authentication failure:', msg);
      isConnected = false;
      isInitializing = false;
      lastInitError = `Authentication failure: ${msg}`;
    });

    client.on('disconnected', (reason: string) => {
      console.log('[WhatsApp] Client disconnected:', reason);
      isConnected = false;
      isInitializing = false;
      qrCodeDataUrl = null;
      connectedPhone = null;
      lastInitError = `Disconnected: ${reason}`;
    });

    client.initialize().catch((err: any) => {
      console.error('[WhatsApp] Initialization error:', err);
      isInitializing = false;
      lastInitError = err?.message || 'Failed to initialize Puppeteer browser';
      client = null;
    });
  } catch (err: any) {
    console.error('[WhatsApp] Unexpected error during init:', err);
    isInitializing = false;
    lastInitError = err?.message || 'Unexpected error launching WhatsApp client';
    client = null;
  }
};

// Return current WhatsApp status
export const getWhatsAppStatus = () => {
  return {
    isConnected,
    isInitializing,
    qrCodeDataUrl,
    connectedPhone,
    lastQrTimestamp,
    initError: lastInitError
  };
};

// Restart / Re-init WhatsApp
export const restartWhatsApp = async (cleanSession: boolean = true) => {
  console.log(`[WhatsApp] Restarting WhatsApp client (cleanSession=${cleanSession})...`);
  if (initTimeoutTimer) clearTimeout(initTimeoutTimer);

  const oldClient = client;
  client = null;
  isConnected = false;
  isInitializing = false;
  qrCodeDataUrl = null;
  connectedPhone = null;

  if (oldClient) {
    oldClient.destroy().catch((err: any) => console.warn('[WhatsApp] Destroy warning:', err.message));
  }

  if (cleanSession) {
    try {
      const authDir = path.join(process.cwd(), '.wwebjs_auth');
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log('[WhatsApp] Cleared .wwebjs_auth session directory.');
      }
    } catch (err: any) {
      console.warn('[WhatsApp] Could not clear .wwebjs_auth directory:', err.message);
    }
  } else {
    try {
      const lockFile = path.join(process.cwd(), '.wwebjs_auth', 'session', 'DevToolsActivePort');
      if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
    } catch (_) {}
  }

  setTimeout(() => {
    initWhatsApp();
  }, 1000);
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

// Helper 1: Notify Admin(s) on New B2B Fund Request (Supports Multiple Admin WhatsApp Numbers)
export const notifyAdminNewB2BFundRequest = async (data: {
  agentName: string;
  agentPhone: string;
  amount: number;
  utr: string;
  mode: string;
  proofUrl?: string;
  adminPhone?: string | string[];
}) => {
  let adminMobiles: string[] = [];

  if (Array.isArray(data.adminPhone) && data.adminPhone.length > 0) {
    adminMobiles = data.adminPhone;
  } else if (typeof data.adminPhone === 'string' && data.adminPhone.trim()) {
    adminMobiles = data.adminPhone.split(',').map(n => n.trim()).filter(Boolean);
  } else {
    const saved = loadConfiguredAdminNumbers();
    if (saved) {
      adminMobiles = saved.split(',').map(n => n.trim()).filter(Boolean);
    } else {
      const rawEnv = process.env.ADMIN_WHATSAPP_NUMBERS || process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_MOBILE || '9876543210';
      adminMobiles = rawEnv.split(',').map(n => n.trim()).filter(Boolean);
    }
  }

  if (adminMobiles.length === 0) {
    adminMobiles = ['9876543210'];
  }

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

  let media: any = null;
  if (data.proofUrl && typeof data.proofUrl === 'string' && data.proofUrl.startsWith('http')) {
    try {
      console.log(`[WhatsApp] Pre-fetching proof image from ${data.proofUrl}...`);
      media = await MessageMedia.fromUrl(data.proofUrl, { unsafeMime: true });
    } catch (mediaErr) {
      console.error('[WhatsApp] Failed to fetch proof image for multi-admin send:', mediaErr);
    }
  }

  let anySent = false;
  for (const mobile of adminMobiles) {
    try {
      const cleanNumber = mobile.replace(/\D/g, '');
      if (!cleanNumber) continue;
      const formattedNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
      const chatId = `${formattedNumber}@c.us`;

      if (media) {
        await client.sendMessage(chatId, media, { caption: message });
        console.log(`[WhatsApp] Sent fund request proof image to admin ${chatId}`);
      } else {
        await client.sendMessage(chatId, message);
        console.log(`[WhatsApp] Sent fund request text message to admin ${chatId}`);
      }
      anySent = true;
    } catch (err) {
      console.error(`[WhatsApp] Failed to send notification to admin mobile ${mobile}:`, err);
    }
  }

  return anySent;
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
