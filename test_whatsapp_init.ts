import { initWhatsApp, getWhatsAppStatus, restartWhatsApp } from './services/whatsapp_service.js';

console.log('Testing WhatsApp init...');
initWhatsApp();

const interval = setInterval(() => {
  const status = getWhatsAppStatus();
  console.log('Status:', JSON.stringify(status, null, 2));
  if (status.qrCodeDataUrl) {
    console.log('SUCCESS! QR Code Data URL length:', status.qrCodeDataUrl.length);
    clearInterval(interval);
    process.exit(0);
  }
}, 2000);

setTimeout(() => {
  console.log('Timeout 30s reached');
  clearInterval(interval);
  process.exit(1);
}, 30000);
