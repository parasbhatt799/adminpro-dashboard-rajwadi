import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = (process.env.CAMLENIO_AEPS_BASE_URL || 'https://cspl.camlenio.com').replace(/['"]/g, '').trim().replace(/\/$/, '');
const API_KEY = (process.env.CAMLENIO_AEPS_API_KEY || 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7').replace(/['"]/g, '').trim();

export interface BBPSHeader {
  'Content-Type': string;
  'X-TIMESTAMP': string;
  'X-REQUEST-ID': string;
  'X-API-KEY': string;
}

export function generateHeaders(): BBPSHeader {
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

export async function callBbpsApi(endpoint: string, payload: any): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = generateHeaders();
  console.log(`[BBPS Service] Outgoing Request [${headers['X-REQUEST-ID']}] to ${url}`);
  console.log('[BBPS Service] Payload:', JSON.stringify(payload));

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
    console.log(`[BBPS Service] Response [${headers['X-REQUEST-ID']}]:`, JSON.stringify(data));
    return data;
  } catch (error: any) {
    console.error(`[BBPS Service] API call failed for endpoint ${endpoint}:`, error);
    throw error;
  }
}

// 1. Biller Info API
export async function getBillerInfo(billerId: string) {
  return callBbpsApi('/api/v1/bbps/billerinfo', { billerId });
}

// 2. Bill Fetch API
export async function fetchBill(payload: any) {
  return callBbpsApi('/api/v1/bbps/billfetch', payload);
}

// 3. Bill Pay API
export async function payBill(payload: any) {
  return callBbpsApi('/api/v1/bbps/billerAdhoc/billpay', payload);
}
