import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

// Polyfill WebSocket for Node 18
(global as any).WebSocket = WebSocket;

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

async function fetchFullMDM() {
  console.log("Generating request for ALL billers (Empty billerInfoRequest)...");
  // Empty request fetches ALL billers
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>\n<billerInfoRequest></billerInfoRequest>`;
  
  const requestId = generateRequestId();
  const encRequest = encryptRequest(xmlPayload).toLowerCase();
  
  const queryUrl = `${BASE_URL}/billpay/extMdmCntrl/mdmRequestNew/xml?accessCode=${ACCESS_CODE}&requestId=${requestId}&ver=1.0&instituteId=${INSTITUTE_ID}`;
  const bodyParams = new URLSearchParams();
  bodyParams.append('encRequest', encRequest);

  console.log(`Sending API request to BillAvenue. Request ID: ${requestId}`);
  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString()
  });

  const responseText = await response.text();
  let ciphertext = responseText;
  if (responseText.includes('<encResponse>')) {
    ciphertext = parseXmlValue(responseText, 'encResponse');
  } else if (responseText.includes('Unauthorized Access')) {
    console.error("FATAL ERROR: Unauthorized Access Detected. Your IP is NOT whitelisted on BillAvenue.");
    return null;
  }

  if (!ciphertext || ciphertext.length < 50) {
    console.error("Invalid or empty response:", responseText);
    return null;
  }

  console.log("Response received. Decrypting data...");
  try {
    const decryptedXml = decryptResponse(ciphertext);
    console.log(`Decrypted XML Size: ${(decryptedXml.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Save to file for debugging
    try {
      const scratchDir = path.join(process.cwd(), 'scratch');
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      fs.writeFileSync(path.join(scratchDir, 'mdm-dump.xml'), decryptedXml);
      console.log('Saved raw XML to scratch/mdm-dump.xml');
    } catch (e) {
      console.log('Could not save debug XML file (ignoring)');
    }

    console.log("Parsing massive XML (This might take a minute)...");
    const parsed = await parseStringPromise(decryptedXml, { explicitArray: false });
    return parsed?.billerInfoResponse;
  } catch (err: any) {
    console.log("Failed to process response:", err.message);
    return null;
  }
}

async function run() {
  console.log("==================================================");
  console.log("Starting Full MDM Master Biller Sync (1 API Call)");
  console.log("==================================================");

  const response = await fetchFullMDM();
  
  if (!response) {
    console.log("Sync Failed! Check IP Whitelisting or 15 requests/day limit.");
    return;
  }

  if (response.errorInfo) {
     console.log(`API Error:`, JSON.stringify(response.errorInfo));
     console.log("Stopping sync.");
     return;
  }
  
  const billers = Array.isArray(response.biller) ? response.biller : (response.biller ? [response.biller] : []);
  console.log(`Successfully parsed ${billers.length} billers from the MDM API.`);
  
  if (billers.length === 0) {
    console.log("No billers found in response.");
    return;
  }

  const mapped = billers.map((b: any) => ({
    biller_id: b.billerId,
    biller_name: b.billerName,
    category: b.category || b.billerCategoryName || 'Unknown',
    metadata: b
  }));

  console.log("Updating database in batches of 200...");
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < mapped.length; i += 200) {
    const chunk = mapped.slice(i, i + 200);
    
    const { error: updateError } = await supabase
      .from('billavenue_billers')
      .upsert(chunk);
      
    if (!updateError) {
      successCount += chunk.length;
    } else {
      failCount += chunk.length;
      console.error(`Batch ${i} Error:`, updateError.message);
    }
    
    const percent = Math.round(((i + chunk.length) / mapped.length) * 100);
    process.stdout.write(`\rProgress: ${percent}% (${successCount} inserted, ${failCount} failed)`);
  }
  
  console.log("\n===========================================");
  console.log("Full Bulk Sync Completed Successfully!");
  console.log("===========================================");
}

run();
