import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
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
  slabs: PayoutSlab[];
}

const DEFAULT_CONFIG: NixasoftConfig = {
  is_active: true,
  api_token: 'fba1b6568695f15ab0a3fc2efbf29f53',
  auth_token: '',
  min_payout: 100,
  max_payout: 200000,
  notice: 'Instant 24x7 IMPS / NEFT Bank Payout',
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

// Call Nixasoft Payout API
export async function executeNixasoftPayout(
  payload: NixasoftPayoutRequest,
  apiTokenOverride?: string
): Promise<NixasoftPayoutResponse> {
  const config = getNixasoftConfig();
  const token = apiTokenOverride || config.api_token || 'fba1b6568695f15ab0a3fc2efbf29f53';

  const url = 'https://api.nixasoft.in/api/service/payout';

  console.log(`[Nixasoft Payout] Sending request to ${url} for reqId: ${payload.requestId}, amount: ${payload.amount}`);

  try {
    const response = await axios.post<NixasoftPayoutResponse>(url, payload, {
      headers: {
        'apiToken': token,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 sec timeout
    });

    console.log('[Nixasoft Payout] Response received:', JSON.stringify(response.data));
    return response.data;
  } catch (error: any) {
    console.error('[Nixasoft Payout] Error from API:', error?.response?.data || error.message);
    if (error?.response?.data) {
      return error.response.data as NixasoftPayoutResponse;
    }
    return {
      statuscode: 'TXF',
      message: error.message || 'Network / Server timeout from Nixasoft',
      data: {
        requestId: payload.requestId,
        description: error.message || 'Unknown network error'
      }
    };
  }
}

// Call Nixasoft Report Status API
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
    const response = await axios.post<NixasoftPayoutResponse>(
      url,
      { requestId },
      { headers, timeout: 15000 }
    );
    return response.data;
  } catch (error: any) {
    console.error('[Nixasoft Status] Error querying status:', error?.response?.data || error.message);
    if (error?.response?.data) {
      return error.response.data as NixasoftPayoutResponse;
    }
    return {
      statuscode: 'TXP',
      message: error.message || 'Failed to fetch status',
      data: { requestId }
    };
  }
}
