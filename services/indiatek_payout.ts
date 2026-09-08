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
          charge_amount: Number(parsed.charge_amount || 0)
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
    charge_amount: 0
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
  ifsc_code: string;
  amount: number;
  beneficiary_name: string;
  customer_mobile: string;
  partner_reference: string;
}

export interface IndiaTekHeaders {
  'Username': string;
  'X-API-SECRET': string;
  'Content-Type': string;
}

export function generateIndiaTekHeaders(username?: string, apiSecret?: string): IndiaTekHeaders {
  const local = getLocalSettings();
  return {
    'Username': (username || local.username || USERNAME).trim(),
    'X-API-SECRET': (apiSecret || local.api_secret || API_SECRET).trim(),
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

  console.log('[IndiaTek Payout] Initiating Payout to:', url);
  console.log('[IndiaTek Payout] Payload:', JSON.stringify(payload));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers as any,
      body: JSON.stringify(payload)
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
 * GET https://api.kingwallet.in/api/v1/b2b/status/{partner_reference}
 */
export async function checkIndiaTekStatus(partnerReference: string, username?: string, apiSecret?: string) {
  const url = `${BASE_URL}/status/${partnerReference}`;
  const headers = generateIndiaTekHeaders(username, apiSecret);
  console.log('[IndiaTek Payout] Checking Status for ref:', partnerReference);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers as any
    });
    const data = await response.json();
    console.log('[IndiaTek Payout] Status Response:', data);
    return { statusCode: response.status, ...data };
  } catch (error: any) {
    console.error('[IndiaTek Payout] Status check error:', error);
    throw error;
  }
}
