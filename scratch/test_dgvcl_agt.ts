import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';

const ACCESS_CODE = process.env.BILLAVENUE_ACCESS_CODE || "";
const WORKING_KEY = process.env.BILLAVENUE_WORKING_KEY || "";
const INSTITUTE_ID = process.env.BILLAVENUE_INSTITUTE_ID || "";
const AGENT_ID = process.env.BILLAVENUE_AGENT_ID || "";
const BASE_URL = 'https://api.billavenue.com';
const URL = `${BASE_URL}/billpay/extBillCntrl/billFetchRequest/xml`;

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
  const billerId = "DAKS00000GUJM5"; // DGVCL
  const caNumber = "45313300660"; 
  const registeredMobile = "9033141002"; 

  console.log(`[Test Fetch AGT] Biller: ${billerId}, CA: ${caNumber}`);

  // Setting channel to AGT (Physical Agent)
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<billFetchRequest>
    <agentDeviceInfo>
        <ip>103.108.7.127</ip>
        <initChannel>AGT</initChannel>
        <mac>01-23-45-67-89-ab</mac>
    </agentDeviceInfo>
    <agentId>${AGENT_ID}</agentId>
    <billerId>${billerId}</billerId>
    <customerInfo>
        <customerMobile>${registeredMobile}</customerMobile>
    </customerInfo>
    <inputParams>
        <input>
            <paramName>Consumer Number</paramName>
            <paramValue>${caNumber}</paramValue>
        </input>
    </inputParams>
</billFetchRequest>`;

  const requestId = generateRequestId();
  const encRequest = encryptRequest(xmlPayload).toLowerCase();
  
  const postParams = new URLSearchParams();
  postParams.append('accessCode', ACCESS_CODE);
  postParams.append('requestId', requestId);
  postParams.append('encRequest', encRequest);
  postParams.append('ver', '1.0');
  postParams.append('instituteId', INSTITUTE_ID);

  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postParams.toString()
    });

    const responseText = await response.text();
    let ciphertext = responseText;
    if (responseText.includes('<encResponse>')) {
      ciphertext = parseXmlValue(responseText, 'encResponse');
    }
    const decryptedXml = decryptResponse(ciphertext);
    console.log("\n==================================================");
    console.log("DECRYPTED XML RESPONSE WITH AGT CHANNEL:");
    console.log("==================================================");
    console.log(decryptedXml);
  } catch (err: any) {
    console.error("API Call Failed:", err.message);
  }
}

run();
