const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ACCESS_CODE = "AVVA15FZ56VG89FFEB";
const WORKING_KEY = "57259B1F76AEAB4E809A959D5E69322A";
const INSTITUTE_ID = "UF01";
const BASE_URL = 'https://stgapi.billavenue.com';
const URL = `${BASE_URL}/billpay/extMdmCntrl/mdmRequestNew/xml`;

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

async function main() {
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><billerInfoRequest></billerInfoRequest>`;
  const requestId = generateRequestId();
  const encRequest = encryptRequest(xmlPayload);
  const postParams = new URLSearchParams();
  postParams.append('accessCode', ACCESS_CODE);
  postParams.append('requestId', requestId);
  postParams.append('encRequest', encRequest);
  postParams.append('ver', '1.0');
  postParams.append('instituteId', INSTITUTE_ID);

  console.log('Fetching billers from UAT Staging...', URL);
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
    console.log('Decrypted Biller XML Length:', decryptedXml.length);
    
    // Write full XML response to scratch/staging_billers_raw.xml
    fs.writeFileSync(path.join(__dirname, 'staging_billers_raw.xml'), decryptedXml, 'utf8');
    console.log('Saved raw XML to scratch/staging_billers_raw.xml');

    // Parse out biller names and IDs to inspect them
    const billerRegex = /<biller>([\s\S]*?)<\/biller>/g;
    const billersList = [];
    let match;
    while ((match = billerRegex.exec(decryptedXml)) !== null) {
      const content = match[1];
      const billerId = parseXmlValue(content, 'billerId');
      const billerName = parseXmlValue(content, 'billerName');
      const categoryName = parseXmlValue(content, 'categoryName');
      billersList.push({ billerId, billerName, categoryName });
    }

    console.log(`Parsed ${billersList.length} billers.`);
    console.log('Snippet of first 20 billers:');
    console.log(billersList.slice(0, 20));

    // Look specifically for Torrent Power or similar billers
    const torrentSearch = billersList.filter(b => b.billerName.toLowerCase().includes('torrent') || b.billerId.toLowerCase().includes('torr'));
    console.log('\nFound matching Torrent billers:');
    console.log(torrentSearch);

    // Look for some electricity billers
    const elecSearch = billersList.filter(b => b.categoryName.toLowerCase().includes('elect')).slice(0, 10);
    console.log('\nSample Electricity billers on Staging:');
    console.log(elecSearch);

  } catch (e) {
    console.error('Failed:', e);
  }
}

main();
