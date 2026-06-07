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

async function main() {
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<billFetchRequest>
    <agentId>${AGENT_ID}</agentId>
    <billerId>TORR00000ELE</billerId>
    <inputParams>
        <input>
            <paramName>Service Number</paramName>
            <paramValue>100000001</paramValue>
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

  console.log('Sending request to:', URL);
  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postParams.toString()
    });

    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    const responseText = await response.text();
    console.log('Response Body snippet (first 1000 chars):');
    console.log(responseText.substring(0, 1000));
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

main();
