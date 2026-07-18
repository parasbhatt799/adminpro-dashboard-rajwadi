import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
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

async function fetchBillerChunk(billerIds: string[]) {
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
    console.error("Invalid Response:", responseText);
    return null;
  }

  try {
    const decryptedXml = decryptResponse(ciphertext);
    const parsed = await parseStringPromise(decryptedXml, { explicitArray: false });
    return parsed?.billerInfoResponse;
  } catch (err) {
    console.log("Decryption failed. Raw response:", responseText);
    return null;
  }
}

async function run() {
  console.log("Starting Bulk Sync of BillAvenue Billers...");

  // 1. Fetch all billers from Supabase
  console.log("Fetching all billers from database...");
  let allBillers: any[] = [];
  let start = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('billavenue_billers')
      .select('biller_id')
      .range(start, start + limit - 1);
      
    if (error) {
      console.error("Database fetch error:", error);
      break;
    }
    if (!data || data.length === 0) break;
    
    allBillers = allBillers.concat(data);
    start += limit;
  }
  
  const billerIds = allBillers.map(b => b.biller_id);
  console.log(`Successfully fetched ${billerIds.length} billers from DB.`);
  
  // 2. Chunk into batches of 1800 (Limit is 2000, playing safe)
  const chunkSize = 1800;
  const chunks: string[][] = [];
  for (let i = 0; i < billerIds.length; i += chunkSize) {
    chunks.push(billerIds.slice(i, i + chunkSize));
  }
  
  console.log(`Divided into ${chunks.length} chunks. (Total API Calls required: ${chunks.length})`);
  
  // 3. Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    console.log(`\nProcessing Chunk ${i + 1}/${chunks.length} (${chunks[i].length} billers)...`);
    
    const response = await fetchBillerChunk(chunks[i]);
    
    if (!response) {
      console.log(`Chunk ${i + 1} Failed! You may have hit the 15 requests/day limit. Try again after 24 hours.`);
      return;
    }

    if (response.errorInfo) {
       console.log(`Chunk ${i + 1} Error:`, JSON.stringify(response.errorInfo));
       console.log("Stopping sync. Try again when the daily limit resets.");
       return;
    }
    
    const billers = Array.isArray(response.biller) ? response.biller : [response.biller];
    console.log(`Successfully fetched ${billers.length} biller parameters from API.`);
    
    // 4. Update Database
    console.log("Updating database...");
    let updateCount = 0;
    
    for (const billerData of billers) {
      if (!billerData || !billerData.billerId) continue;
      
      const metadata = {
        billerInputParams: billerData.billerInputParams,
        billerPaymentModes: billerData.billerPaymentModes,
        billerAmountOptions: billerData.billerAmountOptions
      };
      
      const { error: updateError } = await supabase
        .from('billavenue_billers')
        .update({ metadata })
        .eq('biller_id', billerData.billerId);
        
      if (!updateError) {
        updateCount++;
      }
    }
    
    console.log(`Successfully updated ${updateCount} billers in the database.`);
    
    // Add delay between chunks (5 seconds)
    if (i < chunks.length - 1) {
      console.log("Waiting 5 seconds before next chunk...");
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  
  console.log("\n===========================================");
  console.log("Bulk Sync Completed Successfully!");
  console.log("===========================================");
}

run();
