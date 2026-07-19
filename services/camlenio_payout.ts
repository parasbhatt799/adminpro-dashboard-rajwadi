import { randomUUID } from 'crypto';

const BASE_URL = process.env.CAMLENIO_AEPS_BASE_URL || 'https://cspl.camlenio.com';
const API_KEY = process.env.CAMLENIO_AEPS_API_KEY || '';
const SECRET_KEY = process.env.CAMLENIO_PAYOUT_SECRET_KEY || '';
const USER_ID = process.env.CAMLENIO_PAYOUT_USER_ID || '';
const BANK_PROFILE_ID = process.env.CAMLENIO_BANK_PROFILE_ID || 'BP1001'; // Update this in .env

export interface PennydropResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    apiTransactionId: string;
    beneficiaryName: string;
    beneficiaryAccountNumber: string;
    detail: string;
    tranStatus: string;
  };
}

export interface PayoutResponse {
  success: boolean;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  statusCode: string;
  reference: string;
  utr?: string;
  txnId?: string;
  amount?: number;
  message: string;
}

/**
 * Verify Bank Account using Pennydrop API
 */
export async function verifyBankAccount(accountNumber: string, ifsc: string, transactionId: string): Promise<PennydropResponse> {
  const endpoint = `${BASE_URL}/api/v1/vfc/pennydrop`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': API_KEY,
        'SecretKey': SECRET_KEY,
        'UserId': USER_ID,
      },
      body: JSON.stringify({
        accountNumber,
        ifsc,
        transactionId
      })
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Invalid JSON response from Pennydrop API:', responseText);
      return { success: false, message: 'Invalid response from bank server' };
    }

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
  } catch (error) {
    console.error('Pennydrop API Error:', error);
    return { success: false, message: 'Failed to connect to bank server' };
  }
}

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
  // Note: The documentation specifies "https://cspl.camlenio.com/" as URL. 
  // We append /api/v1/payout as a safe guess if the root URL isn't the endpoint.
  // This may need adjustment based on Camlenio's actual endpoint path.
  const endpoint = `${BASE_URL}/api/v1/payout`;
  
  const timestamp = new Date().toISOString();
  const requestId = randomUUID();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': timestamp,
        'X-REQUEST-ID': requestId,
        'X-API-KEY': API_KEY,
      },
      body: JSON.stringify({
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
      })
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Invalid JSON response from IMPS API:', responseText);
      return { success: false, status: 'FAILED', statusCode: '02', reference: params.reference, message: 'Invalid response from bank server' };
    }

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
  } catch (error) {
    console.error('IMPS Payout API Error:', error);
    return { 
      success: false, 
      status: 'FAILED', 
      statusCode: '02', 
      reference: params.reference, 
      message: 'Failed to connect to bank server' 
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
