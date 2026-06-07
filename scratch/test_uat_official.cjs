const crypto = require('crypto');

const ACCESS_CODE = "AVVA15FZ56VG89FFEB";
const WORKING_KEY = "57259B1F76AEAB4E809A959D5E69322A";
const INSTITUTE_ID = "UF01";
const AGENT_ID = "CC01CC01513515340681";
const BASE_URL = 'https://stgapi.billavenue.com';
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

async function fetchBill(billerId, paramName, paramValue) {
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<billFetchRequest>
    <agentId>${AGENT_ID}</agentId>
    <billerId>${billerId}</billerId>
    <inputParams>
        <input>
            <paramName>${paramName}</paramName>
            <paramValue>${paramValue}</paramValue>
        </input>
    </inputParams>
    <agentDeviceInfo>
        <ip>127.0.0.1</ip>
        <initChannel>INT</initChannel>
        <mac>01-23-45-67-89-ab</mac>
    </agentDeviceInfo>
    <customerInfo>
        <customerMobile>9998120909</customerMobile>
    </customerInfo>
    <billerAdhoc>false</billerAdhoc>
</billFetchRequest>`;

  const requestId = generateRequestId();
  const encRequest = encryptRequest(xmlPayload);
  const postParams = new URLSearchParams();
  postParams.append('accessCode', ACCESS_CODE);
  postParams.append('requestId', requestId);
  postParams.append('encRequest', encRequest);
  postParams.append('ver', '1.0');
  postParams.append('instituteId', INSTITUTE_ID);

  try {
    const response = await globalThis.fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postParams.toString()
    });

    const responseText = await response.text();
    let ciphertext = responseText;
    if (responseText.includes('<encResponse>')) {
      ciphertext = parseXmlValue(responseText, 'encResponse');
      const decryptedXml = decryptResponse(ciphertext);
      return decryptedXml;
    } else {
      return `Non-encrypted response received: ${responseText}`;
    }
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

async function main() {
  console.log("Starting Official UAT Staging Bill Fetch Testing...");
  
  const tests = [
    { billerId: 'DUMMY0000ELC01', param: 'Consumer Number', val: '123456789' },
    { billerId: 'DUMMY0000BBO01', param: 'Account Number', val: '123456789' },
    { billerId: 'BAPL00000GAS01', param: 'Consumer Number', val: '90881111' }
  ];

  for (const t of tests) {
    console.log(`\nTesting Biller: ${t.billerId} with ${t.param}: ${t.val}`);
    const xml = await fetchBill(t.billerId, t.param, t.val);
    if (xml.includes('<responseCode>0000</responseCode>')) {
      console.log(`✅ SUCCESS! Found working staging response:`);
      console.log(xml);
    } else {
      console.log('--- Raw Response ---');
      console.log(xml);
    }
  }
}

main().catch(console.error);
