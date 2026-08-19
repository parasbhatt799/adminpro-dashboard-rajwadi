import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';
import WebSocket from 'ws';

// Polyfill WebSocket for Node 18
(global as any).WebSocket = WebSocket;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ACCESS_CODE = process.env.BILLAVENUE_ACCESS_CODE || "";
const WORKING_KEY = process.env.BILLAVENUE_WORKING_KEY || "";
const INSTITUTE_ID = process.env.BILLAVENUE_INSTITUTE_ID || "";
const BASE_URL = 'https://api.billavenue.com';
const IV = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

function generateRequestId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  for (let i = 0; i < 27; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const now = new Date();
  const yearDigit = now.getFullYear().toString().slice(-1);
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay).toString().padStart(3, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return `${randomPart}${yearDigit}${dayOfYear}${hh}${mm}`;
}

function encryptRequest(plainText: string) {
  const key = crypto.createHash('md5').update(WORKING_KEY).digest();
  const cipher = crypto.createCipheriv('aes-128-cbc', key, IV);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptResponse(encText: string) {
  const key = crypto.createHash('md5').update(WORKING_KEY).digest();
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, IV);
  const isHex = /^[0-9a-fA-F]+$/.test(encText);
  const encoding = isHex ? 'hex' : 'base64';
  let decrypted = decipher.update(encText, encoding as any, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function parseXmlValue(xml: string, tag: string) {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

async function fetchBillerChunkFromBillAvenue(billerIds: string[]) {
  const billerTags = billerIds.map(id => `    <billerId>${id}</billerId>`).join('\n');
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>\n<billerInfoRequest>\n${billerTags}\n</billerInfoRequest>`;
  
  const requestId = generateRequestId();
  const encRequest = encryptRequest(xmlPayload).toLowerCase();
  
  const queryUrl = `${BASE_URL}/billpay/extMdmCntrl/mdmRequestNew/xml?accessCode=${ACCESS_CODE}&requestId=${requestId}&ver=1.0&instituteId=${INSTITUTE_ID}`;
  const bodyParams = new URLSearchParams();
  bodyParams.append('encRequest', encRequest);

  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString()
  });

  const responseText = await response.text();
  let ciphertext = responseText;
  if (responseText.includes('<encResponse>')) {
    ciphertext = parseXmlValue(responseText, 'encResponse');
  }

  if (!ciphertext) {
    console.error("Invalid Response from BillAvenue:", responseText);
    return null;
  }

  try {
    const decryptedXml = decryptResponse(ciphertext);
    const parsed = await parseStringPromise(decryptedXml, { explicitArray: false });
    return parsed?.billerInfoResponse;
  } catch (err) {
    console.error("Decryption failed. Raw response:", responseText);
    return null;
  }
}

export async function syncCategoryBillers(targetCategory?: string) {
  console.log("==================================================");
  if (targetCategory) {
    console.log(`Starting Category Sync for: "${targetCategory}"`);
  } else {
    console.log("Starting Sync for ALL unsynced Categories...");
  }

  // Fetch billers from Supabase
  let query = supabase.from('billavenue_billers').select('*');
  if (targetCategory) {
    query = query.ilike('category', `%${targetCategory}%`);
  }

  const { data: billers, error } = await query;
  if (error || !billers) {
    console.error("Error fetching billers from database:", error);
    return;
  }

  console.log(`Found ${billers.length} billers in database for category target.`);
  
  const billerIds = billers.map(b => b.biller_id);
  if (billerIds.length === 0) {
    console.log("No biller IDs to sync.");
    return;
  }

  console.log(`Total biller IDs to fetch metadata for: ${billerIds.length}`);
  
  // BillAvenue allows up to 1800-2000 billers in 1 API call
  const chunkSize = 1800;
  const chunks: string[][] = [];
  for (let i = 0; i < billerIds.length; i += chunkSize) {
    chunks.push(billerIds.slice(i, i + chunkSize));
  }

  console.log(`Divided into ${chunks.length} API call(s). (Will consume ${chunks.length} of your 15 daily API calls)`);

  for (let i = 0; i < chunks.length; i++) {
    console.log(`\nSending API Request ${i + 1}/${chunks.length} for ${chunks[i].length} billers...`);
    const response = await fetchBillerChunkFromBillAvenue(chunks[i]);

    if (!response) {
      console.error("API Call Failed! Check API credentials or daily rate limit.");
      return;
    }

    if (response.errorInfo) {
      console.error("BillAvenue Error:", response.errorInfo);
      return;
    }

    let rawList: any[] = [];
    if (response.biller) {
      rawList = Array.isArray(response.biller) ? response.biller : [response.biller];
    }

    console.log(`Received metadata for ${rawList.length} billers from BillAvenue API.`);

    const upsertPayload = rawList.map((b: any) => ({
      biller_id: b.billerId,
      biller_name: b.billerName,
      category: b.category || b.billerCategoryName || targetCategory || 'Unknown',
      metadata: b
    }));

    for (let j = 0; j < upsertPayload.length; j += 100) {
      const batch = upsertPayload.slice(j, j + 100);
      const { error: upsertErr } = await supabase.from('billavenue_billers').upsert(batch);
      if (upsertErr) {
        console.error("Batch upsert error:", upsertErr.message);
      }
    }

    console.log(`✅ Successfully updated ${upsertPayload.length} billers with full metadata in database!`);
  }
}

// Execution if called from command line
const args = process.argv.slice(2);
const catArg = args.find(a => a.startsWith('--category='))?.split('=')[1];

syncCategoryBillers(catArg).then(() => {
  console.log("\nProcess completed.");
  process.exit(0);
}).catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
