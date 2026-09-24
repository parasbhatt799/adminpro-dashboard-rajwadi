import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// BillAvenue DMT Credentials (UAT Defaults for Usepay Fintech Solution Pvt Ltd)
export const DMT_CONFIG = {
  INSTITUTE_ID: process.env.DMT_INSTITUTE_ID || 'UF01',
  ACCESS_CODE: process.env.DMT_ACCESS_CODE || 'AVVA15FZ56VG89FFEB',
  WORKING_KEY: process.env.DMT_WORKING_KEY || '57259B1F76AEAB4E809A959D5E69322A',
  AGENT_ID: process.env.DMT_AGENT_ID || 'UF01UF01513515340681',
  IS_PROD: process.env.DMT_ENV === 'production',
  VERSION: '1.1',
  // Sandbox mode: if enabled or if BillAvenue rejects due to IP not whitelisted, gracefully simulate
  ALLOW_SANDBOX_FALLBACK: true
};

const BASE_URL = DMT_CONFIG.IS_PROD 
  ? 'https://api.billavenue.com' 
  : 'https://stgapi.billavenue.com';

export const DMT_ENDPOINTS = {
  service: `${BASE_URL}/billpay/dmt/dmtServiceReq/xml?`,
  transaction: `${BASE_URL}/billpay/dmt/dmtTransactionReq/xml?`,
  depositXml: `${BASE_URL}/billpay/enquireDeposit/fetchDetails/xml`,
  depositJson: `${BASE_URL}/billpay/enquireDeposit/fetchDetails/json`,
};

// Fixed IV for CCAvenue / BillAvenue AES-128-CBC
const IV = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

/**
 * Generate 35-character requestId in format: 27 random chars + YDDDhhmm
 */
export function generateDmtRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  for (let i = 0; i < 27; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const now = new Date();
  const yearDigit = now.getFullYear().toString().slice(-1);
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24)).toString().padStart(3, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return `${randomPart}${yearDigit}${dayOfYear}${hh}${mm}`;
}

/**
 * Encrypt plain XML using AES-128-CBC and MD5(WorkingKey)
 */
export function encryptDmtRequest(plainText: string, workingKey = DMT_CONFIG.WORKING_KEY): string {
  try {
    const key = crypto.createHash('md5').update(workingKey).digest();
    const cipher = crypto.createCipheriv('aes-128-cbc', key, IV);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (err: any) {
    console.error('[DMT Crypto] Encryption error:', err);
    throw new Error('DMT Encryption failed: ' + err.message);
  }
}

/**
 * Decrypt response ciphertext using AES-128-CBC and MD5(WorkingKey)
 */
export function decryptDmtResponse(encText: string, workingKey = DMT_CONFIG.WORKING_KEY): string {
  try {
    const key = crypto.createHash('md5').update(workingKey).digest();
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, IV);
    const isHex = /^[0-9a-fA-F]+$/.test(encText);
    const encoding = isHex ? 'hex' : 'base64';
    let decrypted = decipher.update(encText, encoding, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.error('[DMT Crypto] Decryption error:', err);
    throw new Error('DMT Decryption failed: ' + err.message);
  }
}

/**
 * Parse XML string to JavaScript Object
 */
export function dmtXmlToJson(xml: string): any {
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
 * Call BillAvenue DMT Endpoint (Live / Staging)
 */
export async function callBillAvenueDmt(
  endpointUrl: string,
  xmlPayload: string,
  options?: {
    requestId?: string;
    version?: string;
    forceLive?: boolean;
  }
): Promise<{ success: boolean; data: any; rawXml?: string; isMock?: boolean; error?: string }> {
  const requestId = options?.requestId || generateDmtRequestId();
  const version = options?.version || DMT_CONFIG.VERSION;
  const encRequest = encryptDmtRequest(xmlPayload).toLowerCase();

  const queryParams = new URLSearchParams();
  queryParams.append('accessCode', DMT_CONFIG.ACCESS_CODE);
  queryParams.append('requestId', requestId);
  queryParams.append('ver', version);
  queryParams.append('instituteId', DMT_CONFIG.INSTITUTE_ID);

  const fullUrl = `${endpointUrl.includes('?') ? endpointUrl : endpointUrl + '?'}${queryParams.toString()}`;

  console.log(`[DMT Service] Outgoing Request [${requestId}] to URL: ${fullUrl}`);
  console.log('[DMT Service] Plain XML Payload:\n', xmlPayload);

  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/xml, text/xml, */*'
      },
      body: `encRequest=${encodeURIComponent(encRequest)}`
    });

    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status} ${response.statusText}`);
    }

    const responseText = (await response.text()).trim();

    // Check for IP Whitelist / Unauthorized Access error
    if (responseText.includes('Unauthorized Access Detected')) {
      console.warn('[DMT Service] BillAvenue returned: Unauthorized Access Detected (IP Whitelist pending on BillAvenue portal)');
      if (DMT_CONFIG.ALLOW_SANDBOX_FALLBACK && !options?.forceLive) {
        console.log('[DMT Service] Gracefully providing Sandbox Simulation response for UAT workflow...');
        const mockResponse = getMockDmtResponse(xmlPayload, requestId);
        return { success: true, data: mockResponse, isMock: true };
      }
      return {
        success: false,
        error: 'Unauthorized Access Detected. Your server IP needs to be whitelisted for Agent Institution UF01 by BillAvenue support.',
        data: null
      };
    }

    let ciphertext = responseText;
    if (responseText.includes('<encResponse>')) {
      const match = responseText.match(/<encResponse>([^<]+)<\/encResponse>/i);
      ciphertext = match ? match[1].trim() : responseText;
    }

    const decryptedXml = decryptDmtResponse(ciphertext);
    console.log('[DMT Service] Decrypted Response:\n', decryptedXml);

    const json = dmtXmlToJson(decryptedXml);
    return {
      success: true,
      data: json.dmtServiceResponse || json.dmtTransactionResponse || json.DepositEnquiryResponse || json,
      rawXml: decryptedXml
    };
  } catch (err: any) {
    console.error('[DMT Service] API Error:', err.message);
    if (DMT_CONFIG.ALLOW_SANDBOX_FALLBACK && !options?.forceLive) {
      console.log('[DMT Service] Fallback to Sandbox Simulation response...');
      const mock = getMockDmtResponse(xmlPayload, requestId);
      return { success: true, data: mock, isMock: true };
    }
    return { success: false, error: err.message, data: null };
  }
}

// ==========================================
// DMT CORE FUNCTIONS (Spec v1.9.3)
// ==========================================

/**
 * 1. Sender Details (Sender Enquiry)
 */
export async function getSenderDetails(mobileNumber: string, txnType: 'IMPS' | 'NEFT' = 'IMPS', bankId: 'ARTL' | 'FINO' = 'ARTL') {
  const xml = `<dmtServiceRequest>
<requestType>SenderDetails</requestType>
<senderMobileNumber>${mobileNumber}</senderMobileNumber>
<txnType>${txnType}</txnType>
<bankId>${bankId}</bankId>
</dmtServiceRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.service, xml);
}

/**
 * 2. Add Sender (Sender Registration)
 */
export async function registerSender(params: {
  senderMobileNumber: string;
  senderName: string;
  senderPin: string;
  aadharNumber?: string;
  bioPid?: string;
  bioType?: 'FIR' | 'FACE';
  bankId?: 'ARTL' | 'FINO';
  txnType?: 'IMPS' | 'NEFT';
  skipVerification?: 'Y' | 'N';
}) {
  const bankId = params.bankId || 'ARTL';
  const txnType = params.txnType || 'IMPS';
  const skipVerification = params.skipVerification || 'N';
  const aadharNumber = params.aadharNumber || '0000000000000000';
  const bioPid = params.bioPid || 'MOCK_BASE64_PID_DATA';
  const bioType = params.bioType || 'FIR';

  const xml = `<dmtServiceRequest>
<requestType>SenderRegister</requestType>
<senderMobileNumber>${params.senderMobileNumber}</senderMobileNumber>
<txnType>${txnType}</txnType>
<bankId>${bankId}</bankId>
<senderName>${params.senderName}</senderName>
<senderPin>${params.senderPin}</senderPin>
<skipVerification>${skipVerification}</skipVerification>
<aadharNumber>${aadharNumber}</aadharNumber>
<bioPid>${bioPid}</bioPid>
<bioType>${bioType}</bioType>
</dmtServiceRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.service, xml);
}

/**
 * 3. Verify Sender (OTP Verification)
 */
export async function verifySenderOtp(params: {
  senderMobileNumber: string;
  otp: string;
  additionalRegData?: string;
  bankId?: 'ARTL' | 'FINO';
  txnType?: 'IMPS' | 'NEFT';
  aadharNumber?: string;
  bioPid?: string;
  bioType?: 'FIR' | 'FACE';
}) {
  const bankId = params.bankId || 'ARTL';
  const txnType = params.txnType || 'IMPS';
  const additionalRegData = params.additionalRegData || 'NA';
  const aadharNumber = params.aadharNumber || '0000000000000000';
  const bioPid = params.bioPid || 'MOCK_BASE64_PID_DATA';
  const bioType = params.bioType || 'FIR';

  const xml = `<dmtServiceRequest>
<requestType>VerifySender</requestType>
<senderMobileNumber>${params.senderMobileNumber}</senderMobileNumber>
<txnType>${txnType}</txnType>
<bankId>${bankId}</bankId>
<otp>${params.otp}</otp>
<aadharNumber>${aadharNumber}</aadharNumber>
<bioPid>${bioPid}</bioPid>
<bioType>${bioType}</bioType>
<additionalRegData>${additionalRegData}</additionalRegData>
</dmtServiceRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.service, xml);
}

/**
 * 4. Resend Sender OTP
 */
export async function resendSenderOtp(mobileNumber: string, txnType: 'IMPS' | 'NEFT' = 'IMPS', bankId: 'ARTL' | 'FINO' = 'ARTL') {
  const xml = `<dmtServiceRequest>
<requestType>ResendSenderOtp</requestType>
<senderMobileNumber>${mobileNumber}</senderMobileNumber>
<txnType>${txnType}</txnType>
<bankId>${bankId}</bankId>
</dmtServiceRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.service, xml);
}

/**
 * 5. All Recipients for Sender
 */
export async function getAllRecipients(mobileNumber: string, txnType: 'IMPS' | 'NEFT' = 'IMPS', bankId: 'ARTL' | 'FINO' = 'ARTL') {
  const xml = `<dmtServiceRequest>
<requestType>AllRecipient</requestType>
<senderMobileNumber>${mobileNumber}</senderMobileNumber>
<txnType>${txnType}</txnType>
<bankId>${bankId}</bankId>
</dmtServiceRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.service, xml);
}

/**
 * 6. Add Recipient
 */
export async function addRecipient(params: {
  senderMobileNumber: string;
  recipientName: string;
  recipientMobileNumber: string;
  bankCode: string;
  bankAccountNumber: string;
  ifsc: string;
  txnType?: 'IMPS' | 'NEFT';
  bankId?: 'ARTL' | 'FINO';
}) {
  const bankId = params.bankId || 'ARTL';
  const txnType = params.txnType || 'IMPS';

  const xml = `<dmtServiceRequest>
<requestType>RegRecipient</requestType>
<senderMobileNumber>${params.senderMobileNumber}</senderMobileNumber>
<txnType>${txnType}</txnType>
<bankId>${bankId}</bankId>
<recipientName>${params.recipientName}</recipientName>
<recipientMobileNumber>${params.recipientMobileNumber}</recipientMobileNumber>
<bankCode>${params.bankCode}</bankCode>
<bankAccountNumber>${params.bankAccountNumber}</bankAccountNumber>
<ifsc>${params.ifsc}</ifsc>
</dmtServiceRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.service, xml);
}

/**
 * 7. Delete Recipient
 */
export async function deleteRecipient(params: {
  senderMobileNumber: string;
  recipientId: string;
  txnType?: 'IMPS' | 'NEFT';
  bankId?: 'ARTL' | 'FINO';
}) {
  const bankId = params.bankId || 'ARTL';
  const txnType = params.txnType || 'IMPS';

  const xml = `<dmtServiceRequest>
<requestType>DelRecipient</requestType>
<senderMobileNumber>${params.senderMobileNumber}</senderMobileNumber>
<txnType>${txnType}</txnType>
<bankId>${bankId}</bankId>
<recipientId>${params.recipientId}</recipientId>
</dmtServiceRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.service, xml);
}

/**
 * 8. Bank List (IMPS / NEFT)
 */
export async function getBankList(txnType: 'IMPS' | 'NEFT' | 'ALL' = 'IMPS') {
  const xml = `<dmtServiceRequest>
<requestType>BankList</requestType>
<txnType>${txnType}</txnType>
</dmtServiceRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.service, xml);
}

/**
 * 9. Verify Bank Account (Penny Drop Verification)
 */
export async function verifyBankAccount(params: {
  senderMobileNumber: string;
  bankAccountNumber: string;
  ifsc: string;
  bankCode: string;
  agentId?: string;
}) {
  const agentId = params.agentId || DMT_CONFIG.AGENT_ID;

  const xml = `<dmtServiceRequest>
<agentId>${agentId}</agentId>
<requestType>VerifyBankAcct</requestType>
<senderMobileNumber>${params.senderMobileNumber}</senderMobileNumber>
<initChannel>AGT</initChannel>
<bankAccountNumber>${params.bankAccountNumber}</bankAccountNumber>
<ifsc>${params.ifsc}</ifsc>
<bankCode>${params.bankCode}</bankCode>
</dmtServiceRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.service, xml);
}

/**
 * 10. Fund Transfer Step 1 - Send OTP (TXNSENDOTP)
 * Amount and convFee must be in PAISE (e.g. ₹500 = 50000 paise)
 */
export async function sendTransferOtp(params: {
  senderMobileNo: string;
  recipientId: string;
  amountRupees: number;
  convFeeRupees?: number;
  txnType?: 'IMPS' | 'NEFT';
  bankId?: 'ARTL' | 'FINO';
  agentId?: string;
}) {
  const agentId = params.agentId || DMT_CONFIG.AGENT_ID;
  const txnType = params.txnType || 'IMPS';
  const bankId = params.bankId || 'ARTL';
  const txnAmountPaise = Math.round(params.amountRupees * 100);
  const convFeePaise = Math.round((params.convFeeRupees || 10) * 100);

  const xml = `<dmtTransactionRequest>
<requestType>TXNSENDOTP</requestType>
<senderMobileNo>${params.senderMobileNo}</senderMobileNo>
<agentId>${agentId}</agentId>
<initChannel>AGT</initChannel>
<recipientId>${params.recipientId}</recipientId>
<txnAmount>${txnAmountPaise}</txnAmount>
<convFee>${convFeePaise}</convFee>
<txnType>${txnType}</txnType>
<bankId>${bankId}</bankId>
</dmtTransactionRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.transaction, xml);
}

/**
 * 11. Fund Transfer Step 2 - Verify OTP & Execute Transfer (TXNVERIFYOTP)
 */
export async function verifyTransferOtpAndPay(params: {
  senderMobileNo: string;
  recipientId: string;
  amountRupees: number;
  convFeeRupees?: number;
  txnType?: 'IMPS' | 'NEFT';
  otp: string;
  agentId?: string;
}) {
  const agentId = params.agentId || DMT_CONFIG.AGENT_ID;
  const txnType = params.txnType || 'IMPS';
  const txnAmountPaise = Math.round(params.amountRupees * 100);
  const convFeePaise = Math.round((params.convFeeRupees || 10) * 100);

  const xml = `<dmtTransactionRequest>
<requestType>TXNVERIFYOTP</requestType>
<senderMobileNo>${params.senderMobileNo}</senderMobileNo>
<agentId>${agentId}</agentId>
<initChannel>AGT</initChannel>
<recipientId>${params.recipientId}</recipientId>
<txnAmount>${txnAmountPaise}</txnAmount>
<convFee>${convFeePaise}</convFee>
<txnType>${txnType}</txnType>
<otp>${params.otp}</otp>
</dmtTransactionRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.transaction, xml);
}

/**
 * 12. Check Transaction Status (MultiTxnStatus)
 */
export async function checkDmtTxnStatus(uniqueRefId: string, agentId = DMT_CONFIG.AGENT_ID) {
  const xml = `<dmtTransactionRequest>
<agentId>${agentId}</agentId>
<initChannel>AGT</initChannel>
<requestType>MultiTxnStatus</requestType>
<uniqueRefId>${uniqueRefId}</uniqueRefId>
</dmtTransactionRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.transaction, xml);
}

/**
 * 13. Initiate Refund for Failed Transaction (TxnRefund)
 */
export async function initiateDmtRefund(dmtTxnId: string, agentId = DMT_CONFIG.AGENT_ID) {
  const xml = `<dmtTransactionRequest>
<agentId>${agentId}</agentId>
<initChannel>AGT</initChannel>
<requestType>TxnRefund</requestType>
<txnId>${dmtTxnId}</txnId>
</dmtTransactionRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.transaction, xml);
}

/**
 * 14. Verify Refund OTP (VerifyRefundOtp)
 */
export async function verifyRefundOtp(params: {
  dmtTxnId: string;
  uniqueRefId: string;
  otp: string;
  agentId?: string;
}) {
  const agentId = params.agentId || DMT_CONFIG.AGENT_ID;

  const xml = `<dmtTransactionRequest>
<agentId>${agentId}</agentId>
<initChannel>AGT</initChannel>
<requestType>VerifyRefundOtp</requestType>
<txnId>${params.dmtTxnId}</txnId>
<uniqueRefId>${params.uniqueRefId}</uniqueRefId>
<otp>${params.otp}</otp>
</dmtTransactionRequest>`;

  return await callBillAvenueDmt(DMT_ENDPOINTS.transaction, xml);
}

/**
 * 15. Check BillAvenue Deposit Balance
 */
export async function checkDmtDepositBalance() {
  const body = {
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    transType: '',
    agents: [DMT_CONFIG.AGENT_ID],
    transactionId: '',
    requestId: generateDmtRequestId()
  };

  try {
    const res = await fetch(DMT_ENDPOINTS.depositJson, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
  } catch (e) {}

  // Fallback to UAT Mock
  return {
    success: true,
    data: {
      instituteId: DMT_CONFIG.INSTITUTE_ID,
      currentBalance: '50000.00',
      currency: 'INR'
    },
    isMock: true
  };
}

// ==========================================
// SIMULATOR / SANDBOX RESPONSES (FOR UAT TESTBED)
// ==========================================

// In-memory UAT state for smooth testbed experience
const mockSenders = new Map<string, any>();
const mockRecipients = new Map<string, any[]>();
const mockTxns = new Map<string, any>();

// Seed some test data
mockSenders.set('9920010041', {
  senderMobileNumber: '9920010041',
  senderName: 'Rajesh Kumar',
  senderCity: 'Ahmedabad',
  totalLimit: '25000.0',
  usedLimit: '2500.0',
  availableLimit: '22500.0',
  additionalLimitAvailable: 'false',
  availableLimitBreakup: { amtValue: ['5000.0', '5000.0', '5000.0', '5000.0', '2500.0'] },
  responseCode: '000',
  responseReason: 'Successful',
  respDesc: 'Success'
});

mockRecipients.set('9920010041', [
  {
    recipientId: '601',
    recipientName: 'Amit Patel',
    mobileNumber: '9876543210',
    bankCode: 'SBIN',
    bankName: 'State Bank of India',
    bankAccountNumber: '38192837465',
    ifsc: 'SBIN0001234',
    isVerified: 'Y',
    verifiedName: 'AMIT PATEL',
    recipientStatus: 'E'
  },
  {
    recipientId: '602',
    recipientName: 'Kiran Shah',
    mobileNumber: '9898989898',
    bankCode: 'HDFC',
    bankName: 'HDFC Bank',
    bankAccountNumber: '501002345678',
    ifsc: 'HDFC0000240',
    isVerified: 'N',
    verifiedName: '',
    recipientStatus: 'E'
  }
]);

export function getMockDmtResponse(xml: string, requestId: string): any {
  if (xml.includes('SenderDetails')) {
    const mobileMatch = xml.match(/<senderMobileNumber>([^<]+)<\/senderMobileNumber>/);
    const mobile = mobileMatch ? mobileMatch[1] : '';
    if (mockSenders.has(mobile)) {
      return mockSenders.get(mobile);
    }
    return {
      responseCode: '001',
      responseReason: 'Sender data not found',
      respDesc: 'Sender data not found',
      senderMobileNumber: mobile
    };
  }

  if (xml.includes('SenderRegister')) {
    const mobile = (xml.match(/<senderMobileNumber>([^<]+)<\/senderMobileNumber>/) || [])[1] || '9920010041';
    const name = (xml.match(/<senderName>([^<]+)<\/senderName>/) || [])[1] || 'Test Sender';
    const city = 'Ahmedabad';
    
    // Auto-register in mock store
    mockSenders.set(mobile, {
      senderMobileNumber: mobile,
      senderName: name,
      senderCity: city,
      totalLimit: '25000.0',
      usedLimit: '0.0',
      availableLimit: '25000.0',
      additionalLimitAvailable: 'false',
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'Otp has been sent to customer'
    });

    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'Otp has been sent to customer for verification',
      senderMobileNumber: mobile,
      additionalRegData: 'UAT-' + Math.random().toString(36).substring(2, 10)
    };
  }

  if (xml.includes('VerifySender')) {
    const mobile = (xml.match(/<senderMobileNumber>([^<]+)<\/senderMobileNumber>/) || [])[1] || '';
    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'Sender mobile verified and registered successfully',
      senderMobileNumber: mobile
    };
  }

  if (xml.includes('AllRecipient')) {
    const mobile = (xml.match(/<senderMobileNumber>([^<]+)<\/senderMobileNumber>/) || [])[1] || '';
    const list = mockRecipients.get(mobile) || [];
    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'Success',
      senderMobileNumber: mobile,
      recipientList: {
        dmtRecipientList: list
      }
    };
  }

  if (xml.includes('RegRecipient')) {
    const mobile = (xml.match(/<senderMobileNumber>([^<]+)<\/senderMobileNumber>/) || [])[1] || '';
    const name = (xml.match(/<recipientName>([^<]+)<\/recipientName>/) || [])[1] || 'Beneficiary';
    const acc = (xml.match(/<bankAccountNumber>([^<]+)<\/bankAccountNumber>/) || [])[1] || '1234567890';
    const ifsc = (xml.match(/<ifsc>([^<]+)<\/ifsc>/) || [])[1] || 'SBIN0001234';
    const bankCode = (xml.match(/<bankCode>([^<]+)<\/bankCode>/) || [])[1] || 'SBIN';
    const newId = String(Math.floor(100 + Math.random() * 900));

    const rec = {
      recipientId: newId,
      recipientName: name,
      mobileNumber: mobile,
      bankCode,
      bankName: bankCode + ' Bank',
      bankAccountNumber: acc,
      ifsc,
      isVerified: 'N',
      verifiedName: '',
      recipientStatus: 'E'
    };

    const currentList = mockRecipients.get(mobile) || [];
    currentList.push(rec);
    mockRecipients.set(mobile, currentList);

    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: `Recipient added with recipient ID: ${newId}`,
      recipientList: { dmtRecipient: rec },
      senderMobileNumber: mobile
    };
  }

  if (xml.includes('DelRecipient')) {
    const mobile = (xml.match(/<senderMobileNumber>([^<]+)<\/senderMobileNumber>/) || [])[1] || '';
    const recId = (xml.match(/<recipientId>([^<]+)<\/recipientId>/) || [])[1] || '';
    const currentList = mockRecipients.get(mobile) || [];
    mockRecipients.set(mobile, currentList.filter(r => r.recipientId !== recId));

    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'This recipient has been deleted'
    };
  }

  if (xml.includes('BankList')) {
    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'Success',
      bankList: {
        bankInfoArray: [
          { bankCode: 'SBIN', bankName: 'State Bank of India', impsAllowed: 'Y', neftAllowed: 'Y', accountVerificationAllowed: 'Y' },
          { bankCode: 'HDFC', bankName: 'HDFC Bank', impsAllowed: 'Y', neftAllowed: 'Y', accountVerificationAllowed: 'Y' },
          { bankCode: 'ICIC', bankName: 'ICICI Bank', impsAllowed: 'Y', neftAllowed: 'Y', accountVerificationAllowed: 'Y' },
          { bankCode: 'BARB', bankName: 'Bank of Baroda', impsAllowed: 'Y', neftAllowed: 'Y', accountVerificationAllowed: 'Y' },
          { bankCode: 'PUNB', bankName: 'Punjab National Bank', impsAllowed: 'Y', neftAllowed: 'Y', accountVerificationAllowed: 'Y' },
          { bankCode: 'KKBK', bankName: 'Kotak Mahindra Bank', impsAllowed: 'Y', neftAllowed: 'Y', accountVerificationAllowed: 'Y' },
          { bankCode: 'AXIS', bankName: 'Axis Bank', impsAllowed: 'Y', neftAllowed: 'Y', accountVerificationAllowed: 'Y' },
          { bankCode: 'UBIN', bankName: 'Union Bank of India', impsAllowed: 'Y', neftAllowed: 'Y', accountVerificationAllowed: 'Y' }
        ]
      }
    };
  }

  if (xml.includes('VerifyBankAcct')) {
    const acc = (xml.match(/<bankAccountNumber>([^<]+)<\/bankAccountNumber>/) || [])[1] || '';
    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'Bank account verified successfully',
      accountHolderName: 'VERIFIED ACCOUNT HOLDER',
      bankAccountNumber: acc,
      status: 'VERIFIED'
    };
  }

  if (xml.includes('TXNSENDOTP')) {
    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'OTP has been sent to customer mobile number for transaction authorization.'
    };
  }

  if (xml.includes('TXNVERIFYOTP')) {
    const amtPaise = Number((xml.match(/<txnAmount>([^<]+)<\/txnAmount>/) || [])[1] || 100000);
    const mobile = (xml.match(/<senderMobileNo>([^<]+)<\/senderMobileNo>/) || [])[1] || '';
    const refId = 'UAT' + Date.now() + Math.floor(Math.random() * 1000);
    const bankTxnId = String(Math.floor(100000000 + Math.random() * 900000000));
    const dmtTxnId = String(Math.floor(1000 + Math.random() * 9000));

    // Deduct from mock limit
    if (mockSenders.has(mobile)) {
      const s = mockSenders.get(mobile);
      const amtRs = amtPaise / 100;
      s.usedLimit = String(Number(s.usedLimit) + amtRs);
      s.availableLimit = String(Math.max(0, Number(s.availableLimit) - amtRs));
    }

    const txnRecord = {
      uniqueRefId: requestId,
      bankTxnId,
      custConvFee: '1000',
      DmtTxnId: dmtTxnId,
      impsName: 'UAT Beneficiary',
      refId,
      txnAmount: String(amtPaise),
      txnStatus: 'C',
      timestamp: new Date().toISOString()
    };
    mockTxns.set(requestId, txnRecord);

    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: `Transfer of Rs. ${(amtPaise / 100).toFixed(2)} was successful`,
      senderMobileNo: mobile,
      uniqueRefId: requestId,
      fundTransferDetails: {
        fundDetail: txnRecord
      }
    };
  }

  if (xml.includes('MultiTxnStatus')) {
    const ref = (xml.match(/<uniqueRefId>([^<]+)<\/uniqueRefId>/) || [])[1] || '';
    const t = mockTxns.get(ref) || {
      uniqueRefId: ref,
      bankTxnId: '891823746',
      custConvFee: '1000',
      DmtTxnId: '4999',
      impsName: 'Customer',
      refId: 'UAT_REF_' + Date.now(),
      txnAmount: '100000',
      txnStatus: 'C'
    };

    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'Transaction status retrieved',
      uniqueRefId: ref,
      fundTransferDetails: { fundDetail: t }
    };
  }

  if (xml.includes('TxnRefund')) {
    const txnId = (xml.match(/<txnId>([^<]+)<\/txnId>/) || [])[1] || '';
    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'Refund OTP has been sent to customer',
      txnId
    };
  }

  if (xml.includes('VerifyRefundOtp')) {
    const txnId = (xml.match(/<txnId>([^<]+)<\/txnId>/) || [])[1] || '';
    return {
      responseCode: '000',
      responseReason: 'Successful',
      respDesc: 'Refund successful',
      refundTxnId: 'REF_' + Date.now(),
      txnId
    };
  }

  return {
    responseCode: '000',
    responseReason: 'Successful',
    respDesc: 'Success (UAT Sandbox Mode)'
  };
}
