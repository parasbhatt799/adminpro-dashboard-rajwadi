import dotenv from 'dotenv';
dotenv.config();

import { getBillers } from '../services/billavenue.js';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Polyfill WebSocket for Node 18
(global as any).WebSocket = WebSocket;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncBillers() {
  console.log("==================================================");
  console.log("Starting BillAvenue Master Biller Sync...");
  console.log("Fetching all billers from BillAvenue API. This may take a minute...");
  
  try {
    console.log("Testing with a single biller (TORR00000ELE) to verify connectivity...");
    const response = await getBillers("TORR00000ELE");
    
    if (!response || !response.json || !response.json.billerInfoResponse || !response.json.billerInfoResponse.biller) {
      console.error("Failed to parse biller data from response.");
      process.exit(1);
    }
    
    const billerList = Array.isArray(response.json.billerInfoResponse.biller)
      ? response.json.billerInfoResponse.biller
      : [response.json.billerInfoResponse.biller];

    console.log(`Successfully fetched ${billerList.length} billers from API.`);
    console.log("Starting database synchronization...");

    const mapped = billerList.map((b: any) => ({
      biller_id: b.billerId,
      biller_name: b.billerName,
      category: b.category || b.billerCategoryName,
      metadata: b
    }));

    const BATCH_SIZE = 100;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const chunk = mapped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('billavenue_billers').upsert(chunk);
      
      if (error) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error.message);
        failCount += chunk.length;
      } else {
        successCount += chunk.length;
      }

      // Show progress
      const percent = Math.round((successCount + failCount) / mapped.length * 100);
      process.stdout.write(`\rProgress: ${percent}% (${successCount} inserted, ${failCount} failed) out of ${mapped.length}`);
    }

    console.log("\n\n==================================================");
    console.log("Sync Complete!");
    console.log(`Total Billers Inserted/Updated: ${successCount}`);
    console.log(`Total Failures: ${failCount}`);
    console.log("==================================================");
    
    process.exit(0);
  } catch (error: any) {
    console.error("\nSync failed with error:");
    console.error(error);
    process.exit(1);
  }
}

syncBillers();
