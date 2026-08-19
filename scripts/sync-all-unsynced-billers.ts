import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { getBillers } from '../services/billavenue';
import WebSocket from 'ws';

// Polyfill WebSocket for Node
(global as any).WebSocket = WebSocket;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncAllUnsyncedBillers() {
  console.log("==================================================");
  console.log("Starting Full MDM Metadata Sync for Unsynced Billers...");
  
  // 1. Query all billers from database
  console.log("Fetching billers list from database...");
  let allBillers: any[] = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('billavenue_billers')
      .select('biller_id, category, metadata')
      .range(from, from + step - 1);

    if (error) {
      console.error("Database query error:", error);
      break;
    }

    if (!data || data.length === 0) break;
    allBillers = allBillers.concat(data);
    from += step;
  }

  console.log(`Total billers found in database: ${allBillers.length}`);

  // 2. Identify unsynced billers (where metadata inputParams is missing or not fetched)
  const unsyncedBillers = allBillers.filter(b => {
    const m = b.metadata;
    if (!m) return true;
    const hasParams = m.inputParams || m.billerInputParams || m.paramName || m.interchangeFeeCCF1;
    return !hasParams;
  });

  console.log(`Unsynced billers requiring MDM metadata update: ${unsyncedBillers.length}`);

  const billerIdsToSync = unsyncedBillers.map(b => b.biller_id).filter(Boolean);

  if (billerIdsToSync.length === 0) {
    console.log("🎉 All billers in your database already have full metadata updated!");
    return;
  }

  // 3. Chunk biller IDs into batches of 1800 (BillAvenue limit per request)
  const BATCH_SIZE = 1800;
  const chunks: string[][] = [];
  for (let i = 0; i < billerIdsToSync.length; i += BATCH_SIZE) {
    chunks.push(billerIdsToSync.slice(i, i + BATCH_SIZE));
  }

  console.log(`Divided ${billerIdsToSync.length} billers into ${chunks.length} batch API call(s).`);
  console.log(`(BillAvenue daily limit is 15 API calls. This sync requires ${chunks.length} call(s)).\n`);

  let totalUpdated = 0;

  for (let i = 0; i < chunks.length; i++) {
    const currentChunk = chunks[i];
    console.log(`--------------------------------------------------`);
    console.log(`Sending API Call ${i + 1}/${chunks.length} for ${currentChunk.length} billers...`);

    try {
      const response = await getBillers(currentChunk);

      if (!response || !response.json || !response.json.billerInfoResponse) {
        console.error(`Batch ${i + 1} Failed. API Response:`, response);
        console.log("Stopping sync. Check API credentials or daily rate limit.");
        break;
      }

      let fetchedBillers = response.json.billerInfoResponse.biller;
      if (!fetchedBillers) {
        console.error(`Batch ${i + 1} returned no biller metadata.`);
        continue;
      }

      if (!Array.isArray(fetchedBillers)) {
        fetchedBillers = [fetchedBillers];
      }

      console.log(`Received metadata for ${fetchedBillers.length} billers from BillAvenue. Updating DB...`);

      let batchSuccess = 0;
      for (const b of fetchedBillers) {
        if (!b || !b.billerId) continue;

        b.mdm_fetched = true;
        const { error: updateErr } = await supabase
          .from('billavenue_billers')
          .update({
            biller_name: b.billerName,
            category: b.category || b.billerCategoryName,
            metadata: b
          })
          .eq('biller_id', b.billerId);

        if (!updateErr) {
          batchSuccess++;
        }
      }

      totalUpdated += batchSuccess;
      console.log(`✅ Batch ${i + 1} Complete: ${batchSuccess}/${fetchedBillers.length} billers updated in DB!`);

    } catch (err: any) {
      console.error(`Error processing batch ${i + 1}:`, err.message);
      break;
    }
  }

  console.log("\n==================================================");
  console.log(`🎉 Sync Completed! Total billers updated: ${totalUpdated}`);
  console.log("==================================================");
}

syncAllUnsyncedBillers().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
