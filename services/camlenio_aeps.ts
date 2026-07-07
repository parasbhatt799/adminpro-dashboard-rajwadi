import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = (process.env.CAMLENIO_AEPS_BASE_URL || 'https://cspl.camlenio.com').replace(/['"]/g, '').trim().replace(/\/$/, '');
const API_KEY = (process.env.CAMLENIO_AEPS_API_KEY || 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7').replace(/['"]/g, '').trim();

export interface AEPSHeader {
  'Content-Type': string;
  'X-TIMESTAMP': string;
  'X-REQUEST-ID': string;
  'X-API-KEY': string;
}

export function generateHeaders(): AEPSHeader {
  const timestamp = new Date().toISOString();
  // Generate unique request id
  const requestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  return {
    'Content-Type': 'application/json',
    'X-TIMESTAMP': timestamp,
    'X-REQUEST-ID': requestId,
    'X-API-KEY': API_KEY,
  };
}

export async function callAepsApi(endpoint: string, payload: any): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = generateHeaders();
  console.log(`[AEPS Service] Outgoing Request [${headers['X-REQUEST-ID']}] to ${url}`);
  console.log('[AEPS Service] Payload:', JSON.stringify(payload));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers as any,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch (_) {}
      throw new Error(`HTTP Error Status: ${response.status}${errorBody ? ` (${errorBody})` : ''}`);
    }

    const data = await response.json();
    console.log(`[AEPS Service] Response [${headers['X-REQUEST-ID']}]:`, JSON.stringify(data));
    return data;
  } catch (error: any) {
    console.error(`[AEPS Service] API call failed for endpoint ${endpoint}:`, error);
    throw error;
  }
}

// 1. Outlet Register API
export async function registerOutlet(agentData: any) {
  return callAepsApi('/api/v1/aeps/outletRegister', agentData);
}

// 2. Biometric KYC Status
export async function getKycStatus(spkey: string, txnRef: string) {
  return callAepsApi('/api/v1/aeps/biometric-kyc-status', { spkey, txnRef });
}

// 3. Biometric KYC
export async function submitKyc(kycData: any) {
  return callAepsApi('/api/v1/aeps/biometricKyc', kycData);
}

// 4. Daily Login API
export async function dailyLogin(loginData: any) {
  return callAepsApi('/api/v1/aeps/outlet-login', loginData);
}

// 5. Balance Enquiry API
export async function balanceEnquiry(enquiryData: any) {
  return callAepsApi('/api/v1/aeps/BalanceEnq', enquiryData);
}

// 6. Cash Withdrawal API
export async function cashWithdrawal(withdrawalData: any) {
  return callAepsApi('/api/v1/aeps/CashWithdrawal', withdrawalData);
}

// 7. Mini Statement API
export async function miniStatement(statementData: any) {
  return callAepsApi('/api/v1/aeps/miniStatement', statementData);
}
