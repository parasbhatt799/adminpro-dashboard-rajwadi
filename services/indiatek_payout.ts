import dotenv from 'dotenv';
import dns from 'dns';
import fs from 'fs';
import path from 'path';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

dotenv.config();

const BASE_URL = (process.env.INDIATEK_PAYOUT_BASE_URL || 'https://api.kingwallet.in/api/v1/b2b').replace(/['"]/g, '').trim().replace(/\/$/, '');
const USERNAME = (process.env.INDIATEK_PAYOUT_USERNAME || '').replace(/['"]/g, '').trim();
const API_SECRET = (process.env.INDIATEK_PAYOUT_API_SECRET || '$2y$12$KpOhRX4vBdqLjsAr3mJeTOd6oKAVauwwlWqkdPJEpXqO6HBTkCvgC').replace(/['"]/g, '').trim();

const SETTINGS_FILE = path.join(process.cwd(), '.indiatek_settings.json');

export interface IndiaTekSettings {
  username: string;
  api_secret: string;
  is_active: boolean;
  charge_amount: number;
  verification_charge: number;
  min_payout: number;
  max_payout: number;
}

export function getLocalSettings(): IndiaTekSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed) {
        return {
          username: parsed.username !== undefined ? parsed.username : USERNAME,
          api_secret: parsed.api_secret || API_SECRET,
          is_active: parsed.is_active !== false,
          charge_amount: Number(parsed.charge_amount !== undefined ? parsed.charge_amount : 0),
          verification_charge: Number(parsed.verification_charge !== undefined ? parsed.verification_charge : 5),
          min_payout: Number(parsed.min_payout !== undefined ? parsed.min_payout : 10),
          max_payout: Number(parsed.max_payout !== undefined ? parsed.max_payout : 50000)
        };
      }
    }
  } catch (err) {
    console.error('[IndiaTek] Error reading local settings file:', err);
  }
  return {
    username: USERNAME,
    api_secret: API_SECRET,
    is_active: true,
    charge_amount: 0,
    verification_charge: 5,
    min_payout: 10,
    max_payout: 50000
  };
}

export function saveLocalSettings(settings: Partial<IndiaTekSettings>): IndiaTekSettings {
  const current = getLocalSettings();
  const updated = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString()
  };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    console.log('[IndiaTek] Saved settings to local config file:', SETTINGS_FILE);
  } catch (err) {
    console.error('[IndiaTek] Error writing local settings file:', err);
  }
  return updated;
}

export interface IndiaTekPayoutPayload {
  account_number: string;
  ifsc?: string;
  ifsc_code?: string;
  amount: number;
  beneficiary_name: string;
  customer_mobile: string;
  client_ref_id?: string;
  partner_reference?: string;
}

export interface IndiaTekHeaders {
  'Username': string;
  'X-API-SECRET': string;
  'Content-Type': string;
}

export function generateIndiaTekHeaders(username?: string, apiSecret?: string): IndiaTekHeaders {
  const local = getLocalSettings();
  const sec = (apiSecret || local.api_secret || API_SECRET).trim();
  return {
    'Username': (username || local.username || USERNAME).trim(),
    'X-API-SECRET': sec,
    'Content-Type': 'application/json'
  };
}

/**
 * Check IndiaTek (KingWallet) Balance
 * GET https://api.kingwallet.in/api/v1/b2b/balance
 */
export async function getIndiaTekBalance(username?: string, apiSecret?: string) {
  const url = `${BASE_URL}/balance`;
  const headers = generateIndiaTekHeaders(username, apiSecret);
  console.log('[IndiaTek Payout] Checking Balance at:', url, 'Username:', headers['Username']);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers as any
    });
    const data = await response.json();
    console.log('[IndiaTek Payout] Balance Response:', data);
    return { statusCode: response.status, ...data };
  } catch (error: any) {
    console.error('[IndiaTek Payout] Balance check error:', error);
    throw error;
  }
}

/**
 * Execute IndiaTek Payout
 * POST https://api.kingwallet.in/api/v1/b2b/payout
 */
export async function initiateIndiaTekPayout(payload: IndiaTekPayoutPayload, username?: string, apiSecret?: string) {
  const url = `${BASE_URL}/payout`;
  const headers = generateIndiaTekHeaders(username, apiSecret);

  const refId = (payload.client_ref_id || payload.partner_reference || `PAYOUT_${Date.now()}`).trim();
  const accNo = String(payload.account_number).trim();
  const ifscCode = String(payload.ifsc || payload.ifsc_code || '').trim().toUpperCase();

  // Sanitize customer_mobile to strictly be a valid 10-digit number
  const rawMobile = String(payload.customer_mobile || '').replace(/\D/g, '');
  const cleanMobile = rawMobile.length >= 10 ? rawMobile.slice(-10) : '9876543210';

  // Exact JSON payload format requested by IndiaTek / KingWallet Support
  const requestBody = {
    account_number: accNo,
    ifsc_code: ifscCode,
    amount: Number(payload.amount),
    beneficiary_name: String(payload.beneficiary_name).trim(),
    customer_mobile: cleanMobile,
    client_ref_id: refId
  };

  console.log('[IndiaTek Payout] Initiating Payout to:', url);
  console.log('[IndiaTek Payout] Payload (Strict IndiaTek Format):', JSON.stringify(requestBody));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers as any,
      body: JSON.stringify(requestBody)
    });
    const data = await response.json();
    console.log('[IndiaTek Payout] Payout Response:', data);
    return { statusCode: response.status, ...data };
  } catch (error: any) {
    console.error('[IndiaTek Payout] Payout error:', error);
    throw error;
  }
}

/**
 * Check Transaction Status
 * GET https://api.kingwallet.in/api/v1/b2b/status/{client_ref_id}
 * Supports querying by client_ref_id or txn_id with automatic fallback
 */
export async function checkIndiaTekStatus(
  primaryRef: string,
  username?: string,
  apiSecret?: string,
  alternateRef?: string
) {
  const headers = generateIndiaTekHeaders(username, apiSecret);
  const cleanPrimary = String(primaryRef || '').trim();
  const cleanAlt = String(alternateRef || '').trim();

  const tryFetchStatus = async (ref: string) => {
    const url = `${BASE_URL}/status/${encodeURIComponent(ref)}`;
    console.log('[IndiaTek Payout] Checking Status for ref:', ref, 'at:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: headers as any
    });
    const data = await response.json();
    console.log('[IndiaTek Payout] Status Response for', ref, ':', data);
    return { statusCode: response.status, ...data };
  };

  try {
    const result = await tryFetchStatus(cleanPrimary);

    const isNotFound =
      result.statusCode === 404 ||
      result.status === 'ERROR' ||
      result.status === 'error' ||
      (result.message && /not found/i.test(result.message));

    // If primary reference returned 404 / not found, and alternateRef exists and differs, try alternateRef!
    if (isNotFound && cleanAlt && cleanAlt !== cleanPrimary) {
      console.log(`[IndiaTek Payout] Primary ref '${cleanPrimary}' not found. Trying fallback alternate ref '${cleanAlt}'...`);
      try {
        const altResult = await tryFetchStatus(cleanAlt);
        if (altResult.statusCode === 200 || (altResult.status && altResult.status !== 'ERROR' && altResult.status !== 'error')) {
          return altResult;
        }
        return altResult.statusCode === 200 ? altResult : result;
      } catch (altErr) {
        console.warn('[IndiaTek Payout] Alternate ref status check failed:', altErr);
      }
    }

    return result;
  } catch (error: any) {
    if (cleanAlt && cleanAlt !== cleanPrimary) {
      try {
        console.log(`[IndiaTek Payout] Error on primary ref '${cleanPrimary}'. Trying alternate ref '${cleanAlt}'...`);
        return await tryFetchStatus(cleanAlt);
      } catch (_) {}
    }
    console.error('[IndiaTek Payout] Status check error:', error);
    throw error;
  }
}

export interface IndiaTekBankVerifyPayload {
  account_number: string;
  account_no?: string;
  accountNumber?: string;
  ifsc?: string;
  ifsc_code?: string;
  client_ref_id?: string;
}

/**
 * Verify Bank Account via IndiaTek (KingWallet)
 * POST https://api.kingwallet.in/api/v1/b2b/bank-verify
 */
export async function verifyIndiaTekBankAccount(payload: IndiaTekBankVerifyPayload, username?: string, apiSecret?: string) {
  const url = `${BASE_URL}/bank-verify`;
  const headers = generateIndiaTekHeaders(username, apiSecret);

  const accNo = String(payload.account_number || payload.account_no || payload.accountNumber || '').trim();
  const ifscCode = String(payload.ifsc || payload.ifsc_code || '').trim().toUpperCase();
  const refId = (payload.client_ref_id || `VER_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`).trim();

  const requestBody = {
    account_number: accNo,
    account_no: accNo,
    accountNumber: accNo,
    ifsc: ifscCode,
    ifsc_code: ifscCode,
    client_ref_id: refId
  };

  console.log('[IndiaTek Payout] Verifying Bank Account at:', url);
  console.log('[IndiaTek Payout] Bank Verify Payload:', JSON.stringify(requestBody));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers as any,
      body: JSON.stringify(requestBody)
    });
    const data = await response.json();
    console.log('[IndiaTek Payout] Bank Verify Response:', data);
    return { statusCode: response.status, ...data };
  } catch (error: any) {
    console.error('[IndiaTek Payout] Bank verify error:', error);
    throw error;
  }
}

