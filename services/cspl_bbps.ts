import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const BASE_URL = (process.env.CAMLENIO_BBPS_BASE_URL || 'https://cspl.camlenio.com').replace(/['"]/g, '').trim().replace(/\/$/, '');
// Fallback to AEPS key if BBPS key is not set, assuming they might be the same in some environments
const API_KEY = (process.env.CAMLENIO_BBPS_API_KEY || process.env.CAMLENIO_AEPS_API_KEY || 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7').replace(/['"]/g, '').trim();

export interface CSPLHeader {
  'Content-Type': string;
  'X-TIMESTAMP': string;
  'X-REQUEST-ID': string;
  'X-API-KEY': string;
}

export function generateHeaders(): CSPLHeader {
  const timestamp = new Date().toISOString();
  const requestId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  return {
    'Content-Type': 'application/json',
    'X-TIMESTAMP': timestamp,
    'X-REQUEST-ID': requestId,
    'X-API-KEY': API_KEY,
  };
}

export async function callCsplApi(endpoint: string, payload: any): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = generateHeaders();
  console.log(`[CSPL BBPS Service] Outgoing Request [${headers['X-REQUEST-ID']}] to ${url}`);
  console.log('[CSPL BBPS Service] Payload:', JSON.stringify(payload));

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
    console.log(`[CSPL BBPS Service] Response [${headers['X-REQUEST-ID']}]:`, JSON.stringify(data));
    return data;
  } catch (error: any) {
    console.error(`[CSPL BBPS Service] API call failed for endpoint ${endpoint}:`, error);
    throw error;
  }
}

// 1. Fetch Biller Info
export async function getBillerInfo(billerId: string) {
  return callCsplApi('/bbps/billerinfo', { billerId });
}

// 2. Fetch Bill
export async function fetchBill(
  billerId: string,
  customerMobile: string,
  customerEmail: string,
  inputParams: { paramName: string; paramValue: string }[]
) {
  return callCsplApi('/bbps/billfetch', {
    billerId,
    customerMobile,
    customerEmail,
    inputParams
  });
}

// 3. Pay Bill
export async function payBill(
  requestId: string,
  billerId: string,
  customerName: string,
  customerMobile: string,
  billAmount: number,
  billPeriod: string,
  billNumber: string,
  placeholderValue: string,
  paramValue: string,
  clientReferenceId: string,
  additionalInfo: { infoName: string; infoValue: string }[]
) {
  return callCsplApi('/bbps/billPay', {
    requestId,
    billerId,
    customerName,
    customerMobile,
    billamount: billAmount,
    billPeriod,
    billNumber,
    placeholderValue,
    paramValue,
    client_referenceId: clientReferenceId,
    additionalInfo
  });
}
