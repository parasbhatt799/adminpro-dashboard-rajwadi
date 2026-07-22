import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { parseStringPromise } from 'xml2js';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

// Polyfill WebSocket for Node 18
(global as any).WebSocket = WebSocket;

// Import core service
import { getBillers } from '../services/billavenue.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("==================================================");
  console.log("Starting Full MDM Master Biller Sync (1 API Call)");
  console.log("==================================================");

  try {
    // Calling without arguments generates an empty billerInfoRequest
    console.log("Calling getBillers() to fetch ALL billers...");
    const response = await getBillers();
    
    if (!response || (!response.json && !response.rawXml)) {
      console.log("Sync Failed! Check IP Whitelisting or credentials.");
      return;
    }

    let parsed = response.json;
    
    // If json is null, it means xmlToJson failed due to size limit, we parse it here manually
    if (!parsed && response.rawXml) {
      console.log("Parsing massive XML using xml2js...");
      try {
        const scratchDir = path.join(process.cwd(), 'scratch');
        if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
        fs.writeFileSync(path.join(scratchDir, 'mdm-dump.xml'), response.rawXml);
      } catch(e) {}
      
      parsed = await parseStringPromise(response.rawXml, { explicitArray: false });
    }

    const billerInfoResponse = parsed?.billerInfoResponse;
    if (!billerInfoResponse) {
      console.log("Invalid response format. Missing billerInfoResponse.");
      return;
    }

    if (billerInfoResponse.errorInfo) {
       console.log(`API Error:`, JSON.stringify(billerInfoResponse.errorInfo));
       console.log("Stopping sync.");
       return;
    }
    
    const billers = Array.isArray(billerInfoResponse.biller) ? billerInfoResponse.biller : (billerInfoResponse.biller ? [billerInfoResponse.biller] : []);
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
  } catch (error: any) {
    console.error("Script execution failed:", error.message);
  }
}

run();
