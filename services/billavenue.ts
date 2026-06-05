import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Load Credentials from .env and clean potential quotes/whitespace
const ACCESS_CODE = (process.env.BILLAVENUE_ACCESS_CODE || 'AVVA15FZ56VG89FFEB').replace(/['"]/g, '').trim();
const WORKING_KEY = (process.env.BILLAVENUE_WORKING_KEY || '57259B1F76AEAB4E809A959D5E69322A').replace(/['"]/g, '').trim();
const INSTITUTE_ID = (process.env.BILLAVENUE_INSTITUTE_ID || 'UF01').replace(/['"]/g, '').trim();
const AGENT_ID = (process.env.BILLAVENUE_AGENT_ID || 'CC01CC01513515340681').replace(/['"]/g, '').trim();

// API Endpoints (Dynamic based on Environment: 'production' or 'staging')
const IS_PROD = process.env.BILLAVENUE_ENV === 'production';
const BASE_URL = IS_PROD ? 'https://api.billavenue.com' : 'https://stgapi.billavenue.com';

const ENDPOINTS = {
  billers: `${BASE_URL}/billpay/extMdmCntrl/mdmRequestNew/xml`,
  fetch: `${BASE_URL}/billpay/extBillCntrl/billFetchRequest/xml`,
  pay: `${BASE_URL}/billpay/extBillPayCntrl/billPayRequest/xml`,
  status: `${BASE_URL}/billpay/transactionStatus/fetchInfo/xml`,
  registerComplaint: `${BASE_URL}/billpay/extComplaints/register/xml`,
  trackComplaint: `${BASE_URL}/billpay/extComplaints/track/xml`,
  validate: `${BASE_URL}/billpay/extBillValCntrl/billValidationRequest/xml`,
  plans: `${BASE_URL}/billpay/extPlanMDM/planMdmRequest/xml`
};

// Fixed IV for CCAvenue/BillAvenue AES-128-CBC
const IV = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

/**
 * Generate 35-character requestId in the format: 27 random chars + YDDDhhmm
 */
export function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  for (let i = 0; i < 27; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const now = new Date();
  const yearDigit = now.getFullYear().toString().slice(-1);

  // Calculate day of year
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay).toString().padStart(3, '0');

  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');

  return `${randomPart}${yearDigit}${dayOfYear}${hh}${mm}`;
}

/**
 * Encrypt request data using AES-128-CBC and PKCS5Padding
 */
export function encryptRequest(plainText: string): string {
  try {
    const key = crypto.createHash('md5').update(WORKING_KEY).digest();
    const cipher = crypto.createCipheriv('aes-128-cbc', key, IV);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('[BillAvenue Crypto] Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt response data using AES-128-CBC
 */
export function decryptResponse(encText: string): string {
  try {
    const key = crypto.createHash('md5').update(WORKING_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, IV);
    // Support both hex and base64 responses
    const isHex = /^[0-9a-fA-F]+$/.test(encText);
    const encoding = isHex ? 'hex' : 'base64';
    let decrypted = decipher.update(encText, encoding, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[BillAvenue Crypto] Decryption failed:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Parse a single tag's text content from an XML string
 */
export function parseXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Robust XML to JSON Parser for mapping complex XML objects
 */
export function xmlToJson(xml: string): any {
  const cleanXml = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?xml[\s\S]*?\?>/g, '').trim();

  function parseNode(node: string): any {
    const result: any = {};
    const tagRegex = /<([^> \/\?]+)([^>]*)>([\s\S]*?)<\/\1>/g;
    let match;
    let hasKeys = false;

    while ((match = tagRegex.exec(node)) !== null) {
      hasKeys = true;
      const tagName = match[1];
      const content = match[3].trim();
      const value = content.startsWith('<') && content.endsWith('>') ? parseNode(content) : content;

      if (result[tagName]) {
        if (!Array.isArray(result[tagName])) {
          result[tagName] = [result[tagName]];
        }
        result[tagName].push(value);
      } else {
        result[tagName] = value;
      }
    }

    return hasKeys ? result : node;
  }

  return parseNode(cleanXml);
}

/**
 * Call the BillAvenue API endpoint with encrypted XML payload
 */
export async function callBillAvenueApi(url: string, xmlPayload: string): Promise<any> {
  const requestId = generateRequestId();
  console.log(`[BillAvenue Service] Outgoing Request [${requestId}] to URL: ${url}`);
  console.log('[BillAvenue Service] Plain Payload:', xmlPayload);

  const encRequest = encryptRequest(xmlPayload);
  const postParams = new URLSearchParams();
  postParams.append('accessCode', ACCESS_CODE);
  postParams.append('requestId', requestId);
  postParams.append('encRequest', encRequest);
  postParams.append('ver', '1.0');
  postParams.append('instituteId', INSTITUTE_ID);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postParams.toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    let responseText = await response.text();
    responseText = responseText.trim();
    console.log(`[BillAvenue Service] Received Encrypted Raw Response length: ${responseText.length}`);

    // If response is XML containing an encResponse tag, extract and decrypt it
    let ciphertext = responseText;
    if (responseText.includes('<encResponse>')) {
      ciphertext = parseXmlValue(responseText, 'encResponse');
    } else if (responseText.trim().startsWith('<')) {
      console.warn('[BillAvenue Service] Received plain XML/HTML error response (IP might not be whitelisted):', responseText);
      throw new Error(`BillAvenue returned plain text/XML error (IP might not be whitelisted): ${responseText}`);
    }

    const decryptedXml = decryptResponse(ciphertext);
    console.log('[BillAvenue Service] Decrypted XML Response:', decryptedXml);
    return {
      requestId,
      rawXml: decryptedXml,
      json: xmlToJson(decryptedXml)
    };
  } catch (error: any) {
    console.error('[BillAvenue Service] API call failed:', error);
    throw error;
  }
}

/**
 * Fetch Biller List
 */
export async function getBillers(billerId?: string): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<billerInfoRequest>
    ${billerId ? `<billerId>${billerId}</billerId>` : ''}
</billerInfoRequest>`;
  return callBillAvenueApi(ENDPOINTS.billers, xml);
}

/**
 * Fetch Customer Pending Bill
 */
export async function fetchBill(
  billerId: string,
  customerParams: Record<string, string>,
  customerMobile: string
): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<billFetchRequest>
    <agentId>${AGENT_ID}</agentId>
    <billerId>${billerId}</billerId>
    <inputParams>
        ${Object.entries(customerParams)
          .map(
            ([name, val]) => `
        <input>
            <paramName>${name}</paramName>
            <paramValue>${val}</paramValue>
        </input>`
          )
          .join('')}
    </inputParams>
    <agentDeviceInfo>
        <ip>127.0.0.1</ip>
        <initChannel>AGT</initChannel>
        <mac>01-23-45-67-89-ab</mac>
    </agentDeviceInfo>
    <customerInfo>
        <customerMobile>${customerMobile}</customerMobile>
    </customerInfo>
    <billerAdhoc>false</billerAdhoc>
</billFetchRequest>`;
  return callBillAvenueApi(ENDPOINTS.fetch, xml);
}

/**
 * Validate Biller Credentials / Details
 */
export async function validateBill(
  billerId: string,
  customerParams: Record<string, string>,
  customerMobile: string
): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<billValidationRequest>
    <agentId>${AGENT_ID}</agentId>
    <billerId>${billerId}</billerId>
    <inputParams>
        ${Object.entries(customerParams)
          .map(
            ([name, val]) => `
        <input>
            <paramName>${name}</paramName>
            <paramValue>${val}</paramValue>
        </input>`
          )
          .join('')}
    </inputParams>
    <agentDeviceInfo>
        <ip>127.0.0.1</ip>
        <initChannel>AGT</initChannel>
        <mac>01-23-45-67-89-ab</mac>
    </agentDeviceInfo>
    <customerInfo>
        <customerMobile>${customerMobile}</customerMobile>
    </customerInfo>
</billValidationRequest>`;
  return callBillAvenueApi(ENDPOINTS.validate, xml);
}

/**
 * Execute Bill Payment / Recharge
 */
export async function payBill(
  billerId: string,
  customerParams: Record<string, string>,
  customerMobile: string,
  amount: number,
  paymentMode: string = 'UPI',
  quickPay: string = 'N'
): Promise<any> {
  // Amount converted to paise as required
  const amountInPaise = Math.round(amount * 100);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<billPayRequest>
    <agentId>${AGENT_ID}</agentId>
    <billerId>${billerId}</billerId>
    <customerInfo>
        <customerMobile>${customerMobile}</customerMobile>
    </customerInfo>
    <inputParams>
        ${Object.entries(customerParams)
          .map(
            ([name, val]) => `
        <input>
            <paramName>${name}</paramName>
            <paramValue>${val}</paramValue>
        </input>`
          )
          .join('')}
    </inputParams>
    <amountInfo>
        <amount>${amountInPaise}</amount>
        <currency>INR</currency>
        <custConvFee>0</custConvFee>
    </amountInfo>
    <paymentMethod>
        <paymentMode>${paymentMode}</paymentMode>
        <quickPay>${quickPay}</quickPay>
        <splitPay>N</splitPay>
    </paymentMethod>
    <agentDeviceInfo>
        <ip>127.0.0.1</ip>
        <initChannel>AGT</initChannel>
        <mac>01-23-45-67-89-ab</mac>
    </agentDeviceInfo>
    <billerAdhoc>false</billerAdhoc>
</billPayRequest>`;
  return callBillAvenueApi(ENDPOINTS.pay, xml);
}

/**
 * Get Transaction Status
 */
export async function getTransactionStatus(requestId: string, trackType: string = 'REQUEST_ID'): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<transactionStatusReq>
    <trackType>${trackType}</trackType>
    <trackValue>${requestId}</trackValue>
</transactionStatusReq>`;
  return callBillAvenueApi(ENDPOINTS.status, xml);
}

/**
 * Register a Customer Complaint / Dispute
 */
export async function registerComplaint(
  complaintType: string,
  txnRefId: string,
  complaintDesc: string,
  mobile: string
): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<complaintRequest>
    <complaintType>${complaintType}</complaintType>
    <txnRefId>${txnRefId}</txnRefId>
    <complaintDesc>${complaintDesc}</complaintDesc>
    <agentId>${AGENT_ID}</agentId>
    <mobile>${mobile}</mobile>
</complaintRequest>`;
  return callBillAvenueApi(ENDPOINTS.registerComplaint, xml);
}

/**
 * Track an Existing Complaint Status
 */
export async function trackComplaint(complaintId: string, mobile: string): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<complaintTrackRequest>
    <complaintId>${complaintId}</complaintId>
    <mobile>${mobile}</mobile>
</complaintTrackRequest>`;
  return callBillAvenueApi(ENDPOINTS.trackComplaint, xml);
}

/**
 * Fetch Recharge / Biller Plans (Plan Pull)
 */
export async function getPlans(billerId: string): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<planMdmRequest>
    <billerId>${billerId}</billerId>
</planMdmRequest>`;
  return callBillAvenueApi(ENDPOINTS.plans, xml);
}
