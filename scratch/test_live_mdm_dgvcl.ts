import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';

const ACCESS_CODE = process.env.BILLAVENUE_ACCESS_CODE || "";
const WORKING_KEY = process.env.BILLAVENUE_WORKING_KEY || "";
const INSTITUTE_ID = process.env.BILLAVENUE_INSTITUTE_ID || "";
const BASE_URL = 'https://api.billavenue.com';

const IV = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

function generateRequestId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  for (let i = 0; i < 27; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const now = new Date();
  const yearDigit = now.getFullYear().toString().slice(-1);
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay).toString().padStart(3, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return `${randomPart}${yearDigit}${dayOfYear}${hh}${mm}`;
}

function encryptRequest(plainText) {
  const key = crypto.createHash('md5').update(WORKING_KEY).digest();
  const cipher = crypto.createCipheriv('aes-128-cbc', key, IV);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptResponse(encText) {
  const key = crypto.createHash('md5').update(WORKING_KEY).digest();
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, IV);
  const isHex = /^[0-9a-fA-F]+$/.test(encText);
  const encoding = isHex ? 'hex' : 'base64';
  let decrypted = decipher.update(encText, encoding, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function parseXmlValue(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

async function run() {
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<billerInfoRequest>
    <billerId>DAKS00000GUJM5</billerId>
</billerInfoRequest>`;

  const requestId = generateRequestId();
  const encRequest = encryptRequest(xmlPayload).toLowerCase();
  
  // Construct URL with query parameters exactly as requested by support
  const queryUrl = `${BASE_URL}/billpay/extMdmCntrl/mdmRequestNew/xml?accessCode=${ACCESS_CODE}&requestId=${requestId}&ver=1.0&instituteId=${INSTITUTE_ID}`;
  
  console.log("[Test MDM Support] Query URL:", queryUrl);
  console.log("[Test MDM Support] Plain XML payload:", xmlPayload);

  // Send only encRequest in the POST body as application/x-www-form-urlencoded
  const bodyParams = new URLSearchParams();
  bodyParams.append('encRequest', encRequest);

  try {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString()
    });

    const responseText = await response.text();
    console.log("[Test MDM Support] Raw response text:", responseText);

    let ciphertext = responseText;
    if (responseText.includes('<encResponse>')) {
      ciphertext = parseXmlValue(responseText, 'encResponse');
    }
    const decryptedXml = decryptResponse(ciphertext);
    console.log("\n==================================================");
    console.log("DECRYPTED LIVE XML MDM RESPONSE (SUPPORT FORMAT):");
    console.log("==================================================");
    console.log(decryptedXml);
  } catch (err: any) {
    console.error("API Call Failed:", err.message);
  }
}

run();
