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
  billers: `${BASE_URL}/billpay/extMdmCntrl/mdmRequest/xml`,
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

// Helper to escape XML special characters
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

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
  } catch (error: any) {
    console.error('[BillAvenue Crypto] Decryption failed for text:', encText, error);
    throw new Error(`Decryption failed. Raw response: ${encText.substring(0, 200)}`);
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

export async function callBillAvenueApi(url: string, xmlPayload: string, explicitRequestId?: string): Promise<any> {
  const requestId = explicitRequestId || generateRequestId();
  console.log(`[BillAvenue Service] Outgoing Request [${requestId}] to URL: ${url}`);
  console.log('[BillAvenue Service] Plain Payload:', xmlPayload);

  // BillAvenue support advised sending the encrypted string in lowercase
  const encRequest = encryptRequest(xmlPayload).toLowerCase();

  const queryParams = new URLSearchParams();
  queryParams.append('accessCode', ACCESS_CODE);
  queryParams.append('requestId', requestId);
  queryParams.append('encRequest', encRequest);
  queryParams.append('ver', '1.0');
  queryParams.append('instituteId', INSTITUTE_ID);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/xml, text/xml, */*'
      },
      body: queryParams.toString()
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
      let errorDesc = "BillAvenue returned plain text/XML error (IP might not be whitelisted)";
      if (responseText.includes("Unauthorized Access Detected")) {
        errorDesc = "Unauthorized Access Detected. Please make sure you have access privilege for this module.";
      }
      console.warn(`[BillAvenue Service] ${errorDesc}:`, responseText);
      throw new Error(errorDesc);
    }

    const decryptedXml = decryptResponse(ciphertext);
    console.log('[BillAvenue Service] Decrypted XML Response length:', decryptedXml.length);

    let jsonResult = null;
    try {
      jsonResult = xmlToJson(decryptedXml);
    } catch (e: any) {
      console.warn('[BillAvenue Service] Warning: xmlToJson failed (likely due to huge MDM payload). Returning rawXml only.', e.message);
    }

    return {
      requestId,
      rawXml: decryptedXml,
      json: jsonResult
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
  const xml = billerId
    ? `<?xml version="1.0" encoding="UTF-8"?><billerInfoRequest><agentId>${AGENT_ID}</agentId><billerId>${billerId}</billerId></billerInfoRequest>`
    : `<?xml version="1.0" encoding="UTF-8"?><billerInfoRequest><agentId>${AGENT_ID}</agentId></billerInfoRequest>`;
  return callBillAvenueApi(ENDPOINTS.billers, xml);
}

/**
 * Fetch Customer Pending Bill
 */
export async function fetchBill(
  billerId: string,
  customerParams: Record<string, string>,
  customerMobile: string,
  initChannel: string = 'AGT'
): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<billFetchRequest>
    <agentDeviceInfo>
        <ip>127.0.0.1</ip>
        <initChannel>${initChannel}</initChannel>
        <mac>01-23-45-67-89-ab</mac>
    </agentDeviceInfo>
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
            <paramName>${escapeXml(name)}</paramName>
            <paramValue>${escapeXml(val)}</paramValue>
        </input>`
      )
      .join('')}
    </inputParams>
</billFetchRequest>`;
  return callBillAvenueApi(ENDPOINTS.fetch, xml);
}

/**
 * Validate Biller Credentials / Details
 */
export async function validateBill(
  billerId: string,
  customerParams: Record<string, string>,
  customerMobile: string,
  initChannel: string = 'AGT'
): Promise<any> {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<billValidationRequest>
    <agentDeviceInfo>
        <ip>127.0.0.1</ip>
        <initChannel>${initChannel}</initChannel>
        <mac>01-23-45-67-89-ab</mac>
    </agentDeviceInfo>
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
            <paramName>${escapeXml(name)}</paramName>
            <paramValue>${escapeXml(val)}</paramValue>
        </input>`
      )
      .join('')}
    </inputParams>
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
  quickPay: string = 'N',
  ccf1?: number, // CCF1 + GST in paisa
  billDetails?: any,
  remitterName?: string,
  initChannel: string = 'AGT',
  fetchRequestId?: string
): Promise<any> {
  // Amount converted to paise as required
  const amountInPaise = Math.round(amount * 100);
  const paymentRefId = generateRequestId();
  const nameOfRemitter = remitterName || 'UsePay Customer';

  let paymentAccountInfo = 'Cash Payment';
  const mode = paymentMode.trim().toUpperCase();
  if (mode === 'UPI' || mode === 'BHARAT QR') {
    paymentAccountInfo = `${customerMobile}@upi`;
  } else if (mode === 'WALLET') {
    paymentAccountInfo = `UsePay|${customerMobile}`;
  } else if (mode === 'INTERNET BANKING') {
    paymentAccountInfo = `INTB${Date.now()}|INTB${Date.now()}`;
  } else if (mode === 'DEBIT CARD' || mode === 'CREDIT CARD' || mode === 'PREPAID CARD') {
    paymentAccountInfo = `1234|UsePay`;
  } else if (mode === 'CASH') {
    paymentAccountInfo = 'Cash Payment';
  } else {
    paymentAccountInfo = 'USSD Payment';
  }

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<billPaymentRequest>
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
            <paramName>${escapeXml(name)}</paramName>
            <paramValue>${escapeXml(val)}</paramValue>
        </input>`
      )
      .join('')}
    </inputParams>
    <amountInfo>
        <amount>${amountInPaise}</amount>
        <currency>356</currency>
        <custConvFee>0</custConvFee>
        ${ccf1 !== undefined && !isNaN(ccf1) ? `<CCF1>${ccf1}</CCF1>` : ''}
    </amountInfo>
    <paymentMethod>
        <paymentMode>${paymentMode}</paymentMode>
        <quickPay>${quickPay}</quickPay>
        <splitPay>N</splitPay>
    </paymentMethod>
    <paymentInfo>
        <info>
            <infoName>Remitter Name</infoName>
            <infoValue>${nameOfRemitter}</infoValue>
        </info>
        <info>
            <infoName>PaymentRefId</infoName>
            <infoValue>${paymentRefId}</infoValue>
        </info>
        <info>
            <infoName>Payment Account Info</infoName>
            <infoValue>${paymentAccountInfo}</infoValue>
        </info>
        <info>
            <infoName>Payment mode</infoName>
            <infoValue>${paymentMode}</infoValue>
        </info>
    </paymentInfo>
    <agentDeviceInfo>
        <ip>127.0.0.1</ip>
        <initChannel>${initChannel}</initChannel>
        <mac>01-23-45-67-89-ab</mac>
    </agentDeviceInfo>
    <billerAdhoc>${quickPay === 'Y' ? 'true' : 'false'}</billerAdhoc>`;

  if (quickPay !== 'Y' && billDetails) {
    const fetchedAmountInPaise = billDetails.billAmount ? Math.round(Number(billDetails.billAmount) * 100) : amountInPaise;
    xml += `\n    <billerResponse>`;

    if (billDetails.rawBillerResponse && typeof billDetails.rawBillerResponse === 'object') {
      const raw = { ...billDetails.rawBillerResponse };
      // Do NOT override raw.billAmount. BBPS requires the billerResponse block to be passed
      // EXACTLY as received from the fetch call. The actual payment amount is in <amountInfo>.

      for (const [key, value] of Object.entries(raw)) {
        if (value !== null && value !== undefined && typeof value !== 'object') {
          xml += `\n        <${key}>${escapeXml(String(value))}</${key}>`;
        }
      }
    } else {
      xml += `
        <billAmount>${fetchedAmountInPaise}</billAmount>
        ${billDetails.billDate && billDetails.billDate !== 'N/A' ? `<billDate>${billDetails.billDate}</billDate>` : ''}
        ${billDetails.billNumber && billDetails.billNumber !== 'N/A' ? `<billNumber>${billDetails.billNumber}</billNumber>` : ''}
        ${billDetails.billPeriod && billDetails.billPeriod !== 'N/A' ? `<billPeriod>${billDetails.billPeriod}</billPeriod>` : ''}
        ${billDetails.customerName && billDetails.customerName !== 'N/A' ? `<customerName>${billDetails.customerName}</customerName>` : ''}
        ${billDetails.dueDate && billDetails.dueDate !== 'N/A' ? `<dueDate>${billDetails.dueDate}</dueDate>` : ''}`;
    }
    xml += `\n    </billerResponse>`;
  }

  if (quickPay !== 'Y' && billDetails?.additionalInfo && Array.isArray(billDetails.additionalInfo)) {
    xml += `
    <additionalInfo>
        ${billDetails.additionalInfo
        .map(
          (info: any) => `
        <info>
            <infoName>${info.infoName}</infoName>
            <infoValue>${info.infoValue}</infoValue>
        </info>`
        )
        .join('')}
    </additionalInfo>`;
  }

  xml += `
</billPaymentRequest>`;

  return callBillAvenueApi(ENDPOINTS.pay, xml, fetchRequestId);
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
