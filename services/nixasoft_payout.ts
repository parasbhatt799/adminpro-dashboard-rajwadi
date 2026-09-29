import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'nixasoft_payout_config.json');

export interface PayoutSlab {
  id: string;
  min_amount: number;
  max_amount: number;
  charge_type: 'flat' | 'percentage';
  charge_value: number;
  is_active: boolean;
}

export interface NixasoftConfig {
  is_active: boolean;
  api_token: string;
  auth_token: string;
  min_payout: number;
  max_payout: number;
  notice?: string;
  verification_charge: number;
  is_verification_enabled: boolean;
  slabs: PayoutSlab[];
}

const DEFAULT_CONFIG: NixasoftConfig = {
  is_active: true,
  api_token: 'fba1b6568695f15ab0a3fc2efbf29f53',
  auth_token: '',
  min_payout: 100,
  max_payout: 200000,
  notice: 'Instant 24x7 IMPS / NEFT Bank Payout',
  verification_charge: 3,
  is_verification_enabled: true,
  slabs: [
    {
      id: 'slab-1',
      min_amount: 100,
      max_amount: 50000,
      charge_type: 'flat',
      charge_value: 25,
      is_active: true
    },
    {
      id: 'slab-2',
      min_amount: 50001,
      max_amount: 100000,
      charge_type: 'flat',
      charge_value: 50,
      is_active: true
    },
    {
      id: 'slab-3',
      min_amount: 100001,
      max_amount: 200000,
      charge_type: 'flat',
      charge_value: 75,
      is_active: true
    }
  ]
};

// Ensure data directory and config file exist
export function getNixasoftConfig(): NixasoftConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.ensureDirSync(path.dirname(CONFIG_FILE));
      fs.writeJsonSync(CONFIG_FILE, DEFAULT_CONFIG, { spaces: 2 });
      return DEFAULT_CONFIG;
    }
    const data = fs.readJsonSync(CONFIG_FILE);
    return {
      ...DEFAULT_CONFIG,
      ...data,
      verification_charge: data.verification_charge !== undefined ? Number(data.verification_charge) : DEFAULT_CONFIG.verification_charge,
      is_verification_enabled: data.is_verification_enabled !== undefined ? Boolean(data.is_verification_enabled) : DEFAULT_CONFIG.is_verification_enabled,
      slabs: Array.isArray(data.slabs) && data.slabs.length > 0 ? data.slabs : DEFAULT_CONFIG.slabs
    };
  } catch (err) {
    console.error('[Nixasoft] Error reading config file, using defaults:', err);
    return DEFAULT_CONFIG;
  }
}

export function saveNixasoftConfig(config: Partial<NixasoftConfig>): NixasoftConfig {
  try {
    const current = getNixasoftConfig();
    const updated: NixasoftConfig = {
      ...current,
      ...config,
      verification_charge: config.verification_charge !== undefined ? Number(config.verification_charge) : current.verification_charge,
      is_verification_enabled: config.is_verification_enabled !== undefined ? Boolean(config.is_verification_enabled) : current.is_verification_enabled,
      slabs: config.slabs ? config.slabs : current.slabs
    };
    fs.ensureDirSync(path.dirname(CONFIG_FILE));
    fs.writeJsonSync(CONFIG_FILE, updated, { spaces: 2 });
    return updated;
  } catch (err) {
    console.error('[Nixasoft] Error saving config file:', err);
    throw err;
  }
}

// Calculate slab charge for a given amount
export function calculateSlabCharge(amount: number, config?: NixasoftConfig): { charge: number; slab: PayoutSlab | null } {
  const currentConfig = config || getNixasoftConfig();
  const activeSlabs = (currentConfig.slabs || []).filter(s => s.is_active);

  // Sort slabs by min_amount ascending
  const sorted = [...activeSlabs].sort((a, b) => a.min_amount - b.min_amount);

  for (const slab of sorted) {
    if (amount >= slab.min_amount && amount <= slab.max_amount) {
      const charge = slab.charge_type === 'percentage'
        ? Math.round(((amount * slab.charge_value) / 100) * 100) / 100
        : slab.charge_value;
      return { charge: Math.max(0, charge), slab };
    }
  }

  // Fallback if amount exceeds highest slab: use the highest slab or default 25
  if (sorted.length > 0) {
    const highest = sorted[sorted.length - 1];
    if (amount > highest.max_amount) {
      const charge = highest.charge_type === 'percentage'
        ? Math.round(((amount * highest.charge_value) / 100) * 100) / 100
        : highest.charge_value;
      return { charge: Math.max(0, charge), slab: highest };
    }
  }

  return { charge: 25, slab: null };
}

export interface NixasoftPayoutRequest {
  amount: string;
  mobileNumber: string;
  requestId: string;
  accountNumber: string;
  ifscCode: string;
  beneficiaryName: string;
  bankName: string;
  transferMode: 'IMPS' | 'NEFT' | 'RTGS';
  emailId: string;
  latitude: string;
  longitude: string;
}

export interface NixasoftPayoutResponse {
  statuscode: 'TXN' | 'TXP' | 'TXF';
  message: string;
  data?: {
    requestId?: string;
    apiTxnId?: string;
    utr?: string;
    amount?: string;
    charge?: string;
    opening_balance?: string;
    closing_balance?: string;
    beneficiaryName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    description?: string;
  };
}

// Call Nixasoft Payout API using native fetch
export async function executeNixasoftPayout(
  payload: NixasoftPayoutRequest,
  apiTokenOverride?: string
): Promise<NixasoftPayoutResponse> {
  const config = getNixasoftConfig();
  const token = apiTokenOverride || config.api_token || 'fba1b6568695f15ab0a3fc2efbf29f53';

  const url = 'https://api.nixasoft.in/api/v2/service/payout';

  console.log(`[Nixasoft Payout] Sending request to ${url} for reqId: ${payload.requestId}, amount: ${payload.amount}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apiToken': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const resJson = await response.json() as NixasoftPayoutResponse;
    console.log('[Nixasoft Payout] Response received:', JSON.stringify(resJson));
    return resJson;
  } catch (error: any) {
    console.error('[Nixasoft Payout] Error from API:', error.message);
    return {
      statuscode: 'TXF',
      message: error.message || 'Network / Server timeout from payment provider',
      data: {
        requestId: payload.requestId,
        description: error.message || 'Unknown network error'
      }
    };
  }
}

// Call Nixasoft Report Status API using native fetch
export async function checkNixasoftStatus(
  requestId: string,
  apiTokenOverride?: string,
  authTokenOverride?: string
): Promise<NixasoftPayoutResponse> {
  const config = getNixasoftConfig();
  const token = apiTokenOverride || config.api_token || 'fba1b6568695f15ab0a3fc2efbf29f53';
  const authToken = authTokenOverride || config.auth_token;

  const url = 'https://api.nixasoft.in/api/payout/report-status';

  const headers: Record<string, string> = {
    'apiToken': token,
    'Content-Type': 'application/json'
  };

  if (authToken) {
    headers['Authorization'] = authToken.startsWith('Basic ') ? authToken : `Basic ${authToken}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requestId }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const resJson = await response.json() as NixasoftPayoutResponse;
    return resJson;
  } catch (error: any) {
    console.error('[Nixasoft Status] Error querying status:', error.message);
    return {
      statuscode: 'TXP',
      message: error.message || 'Failed to fetch status',
      data: { requestId }
    };
  }
}

export interface NixasoftVerificationRequest {
  accountNumber: string;
  ifscCode: string;
  requestId: string;
}

export interface NixasoftVerificationResponse {
  statuscode: 'TXN' | 'TXP' | 'TXF' | 'ERR' | string;
  message?: string;
  data?: {
    reference_id?: string;
    name_at_bank?: string;
    bank_name?: string;
    utr?: string;
    city?: string;
    branch?: string;
    micr?: string;
    name_match_score?: string;
    name_match_result?: string;
    account_status?: string;
    account_status_code?: string;
    ifsc_details?: {
      bank?: string;
      ifsc?: string;
      micr?: string;
      nbin?: string;
      address?: string;
      city?: string;
      state?: string;
      branch?: string;
      ifsc_subcode?: string;
      category?: string;
      swift_code?: string;
    };
  };
}

// Call Nixasoft Bank Verification 1 API
export async function executeNixasoftVerification(
  payload: NixasoftVerificationRequest,
  apiTokenOverride?: string
): Promise<NixasoftVerificationResponse> {
  const config = getNixasoftConfig();
  const token = apiTokenOverride || config.api_token || 'fba1b6568695f15ab0a3fc2efbf29f53';
  const url = 'https://api.nixasoft.in/api/verification';

  console.log(`[Nixasoft Verification] Verifying account: ${payload.accountNumber}, IFSC: ${payload.ifscCode}, reqId: ${payload.requestId}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apiToken': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'bankverification',
        accountNumber: payload.accountNumber,
        ifscCode: payload.ifscCode,
        requestId: payload.requestId
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const resJson = await response.json() as NixasoftVerificationResponse;
    console.log('[Nixasoft Verification] Response received:', JSON.stringify(resJson));
    return resJson;
  } catch (error: any) {
    console.error('[Nixasoft Verification] Error from API:', error.message);
    return {
      statuscode: 'ERR',
      message: error.message || 'Verification service timeout / server error'
    };
  }
}
