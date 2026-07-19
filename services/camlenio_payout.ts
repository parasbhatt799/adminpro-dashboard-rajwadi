import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = (process.env.CAMLENIO_AEPS_BASE_URL || 'https://cspl.camlenio.com').replace(/['"]/g, '').trim().replace(/\/$/, '');
const API_KEY = (process.env.CAMLENIO_AEPS_API_KEY || 'fjf0f2xy3W01NTtSDTUS62rdKyVqPSY7').replace(/['"]/g, '').trim();
const SECRET_KEY = (process.env.CAMLENIO_PAYOUT_SECRET_KEY || '').replace(/['"]/g, '').trim();

export interface PennydropResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface PayoutResponse {
  success: boolean;
  status: string;
  statusCode?: string;
  reference: string;
  utr?: string;
  txnId?: string;
  amount?: number;
  message?: string;
}

export interface PayoutHeader {
  'Content-Type': string;
  'X-TIMESTAMP': string;
  'X-REQUEST-ID': string;
  'X-API-KEY': string;
}

export function generateHeaders(): PayoutHeader {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  return {
    'Content-Type': 'application/json',
    'X-TIMESTAMP': timestamp,
    'X-REQUEST-ID': requestId,
    'X-API-KEY': API_KEY,
  };
}

export async function callPayoutApi(endpoint: string, payload: any): Promise<any> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = generateHeaders();
  console.log(`[Payout Service] Outgoing Request [${headers['X-REQUEST-ID']}] to ${url}`);
  console.log('[Payout Service] Payload:', JSON.stringify(payload));

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
    console.log(`[Payout Service] Response [${headers['X-REQUEST-ID']}]:`, JSON.stringify(data));
    return data;
  } catch (error: any) {
    console.error(`[Payout Service] API call failed for endpoint ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Verify Bank Account using Pennydrop API
 */
export async function verifyBankAccount(accountNumber: string, ifsc: string, transactionId: string): Promise<PennydropResponse> {
  try {
    const url = `${BASE_URL}/api/v1/vfc/pennydrop`;
    const headers = {
      'Content-Type': 'application/json',
      'ApiKey': API_KEY,
      'SecretKey': SECRET_KEY,
      'UserId': process.env.CAMLENIO_PAYOUT_USER_ID || ''
    };

    console.log(`[Payout Service] Pennydrop Request to ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accountNumber,
        ifsc,
        transactionId
      })
    });

    if (!response.ok) {
      let errorBody = "";
      try { errorBody = await response.text(); } catch (_) {}
      throw new Error(`HTTP Error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    console.log(`[Payout Service] Pennydrop Response:`, JSON.stringify(data));

    if (data.status === 'SUCCESS' && data.data?.tranStatus === 'Success') {
      return {
        success: true,
        message: data.message,
        data: data.data
      };
    } else {
      return {
        success: false,
        message: data.message || 'Verification failed'
      };
    }
  } catch (error: any) {
    console.error('Pennydrop API Error:', error);
    return { 
      success: false, 
      message: `API Error: ${error.message}`
    };
  }
}

const BANK_PROFILE_ID = process.env.CAMLENIO_BANK_PROFILE_ID || 'BP1001';

/**
 * Initiate IMPS Payout
 */
export async function processImpsPayout(params: {
  amount: number;
  reference: string;
  bankAccount: string;
  ifsc: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  remarks?: string;
}): Promise<PayoutResponse> {
  try {
    const data = await callPayoutApi('/api/v1/payout/transaction', {
      amount: params.amount,
      reference: params.reference,
      bankProfileId: BANK_PROFILE_ID,
      bankAccount: params.bankAccount,
      ifsc: params.ifsc,
      latitude: '23.0225', // Defaulting to Gujarat coordinates as fallback
      longitude: '72.5714',
      name: params.name,
      email: params.email || 'noreply@example.com',
      phone: params.phone,
      address: params.address || 'Gujarat',
      remarks: params.remarks || 'Payout Request'
    });

    if (data.status === 'SUCCESS' || data.status === 'PENDING') {
      return {
        success: true,
        status: data.status,
        statusCode: data.statusCode,
        reference: data.reference,
        utr: data.utr,
        txnId: data.txnId,
        amount: data.amount,
        message: data.message
      };
    } else {
      return {
        success: false,
        status: 'FAILED',
        statusCode: data.statusCode || '02',
        reference: params.reference,
        message: data.message || 'Payout failed'
      };
    }
  } catch (error: any) {
    console.error('IMPS Payout API Error:', error);
    return { 
      success: false, 
      status: 'FAILED', 
      statusCode: '99', 
      reference: params.reference, 
      message: `API Error: ${error.message}`
    };
  }
}

import * as crypto from 'crypto';

/**
 * Verify Webhook HMAC Signature
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!signature || !SECRET_KEY) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(rawBody)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}
