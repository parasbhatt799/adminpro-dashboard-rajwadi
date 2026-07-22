import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Polyfill WebSocket for Node 18
(global as any).WebSocket = WebSocket;

import { callBillAvenueApi, ENDPOINTS } from '../services/billavenue.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchBillerChunk(billerIds: string[]) {
  const billerTags = billerIds.map(id => `    <billerId>${id}</billerId>`).join('\n');
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>\n<billerInfoRequest>\n${billerTags}\n</billerInfoRequest>`;
  
  try {
    const response = await callBillAvenueApi(ENDPOINTS.billers, xmlPayload);
    return response.json?.billerInfoResponse;
  } catch (error: any) {
    console.error("Chunk Fetch Error:", error.message);
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
  
  // 2. Chunk into batches of 1950 (Limit is 2000, playing safe)
  const chunkSize = 1950;
  const chunks: string[][] = [];
  for (let i = 0; i < billerIds.length; i += chunkSize) {
    chunks.push(billerIds.slice(i, i + chunkSize));
  }
  
  console.log(`Divided into ${chunks.length} chunks. (Total API Calls required: ${chunks.length})`);
  
  let successCount = 0;
  let failCount = 0;

  // 3. Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    console.log(`\nProcessing Chunk ${i + 1}/${chunks.length} (${chunks[i].length} billers)...`);
    
    const response = await fetchBillerChunk(chunks[i]);
    
    if (!response || !response.biller) {
      console.log(`Chunk ${i + 1} Failed! You may have hit the 15 requests/day limit or invalid ENC.`);
      failCount += chunks[i].length;
      continue;
    }

    const billers = Array.isArray(response.biller) ? response.biller : [response.biller];
    
    const mapped = billers.map((b: any) => ({
      biller_id: b.billerId,
      biller_name: b.billerName,
      category: b.category || b.billerCategoryName || 'Unknown',
      metadata: b
    }));
    
    console.log(`Extracted ${mapped.length} billers. Upserting to database...`);
    
    const BATCH_SIZE = 200;
    for (let j = 0; j < mapped.length; j += BATCH_SIZE) {
      const dbChunk = mapped.slice(j, j + BATCH_SIZE);
      const { error: updateError } = await supabase
        .from('billavenue_billers')
        .upsert(dbChunk);
        
      if (updateError) {
        console.error("DB Upsert Error:", updateError.message);
      } else {
        successCount += dbChunk.length;
      }
    }
    
    console.log(`Completed Chunk ${i + 1}.`);
  }
  
  console.log("\n===========================================");
  console.log("Bulk Sync Completed!");
  console.log(`Successfully Updated: ${successCount} billers`);
  console.log(`Failed to update: ${failCount} billers`);
  console.log("===========================================");
}

run();
