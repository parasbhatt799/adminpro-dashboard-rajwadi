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

export async function syncCategoryBillers(targetCategory?: string) {
  console.log("==================================================");
  if (targetCategory) {
    console.log(`Starting Category Sync for: "${targetCategory}"`);
  } else {
    console.log("Starting Sync for ALL Categories...");
  }

  // Fetch billers from Supabase
  let query = supabase.from('billavenue_billers').select('biller_id, category, metadata');
  if (targetCategory) {
    query = query.ilike('category', `%${targetCategory}%`);
  }

  const { data: billers, error } = await query;
  if (error || !billers) {
    console.error("Error fetching billers from database:", error);
    return;
  }

  console.log(`Found ${billers.length} billers in database for category target.`);
  
  const billerIds = billers.map(b => b.biller_id).filter(Boolean);
  if (billerIds.length === 0) {
    console.log("No biller IDs to sync.");
    return;
  }

  console.log(`Total biller IDs to fetch MDM metadata for: ${billerIds.length}`);
  
  // BillAvenue allows up to 1800 billers in 1 API call
  const BATCH_SIZE = 1800;
  const chunks: string[][] = [];
  for (let i = 0; i < billerIds.length; i += BATCH_SIZE) {
    chunks.push(billerIds.slice(i, i + BATCH_SIZE));
  }

  console.log(`Divided into ${chunks.length} API call(s). (Will consume ${chunks.length} of your 15 daily API calls)`);

  let totalUpdated = 0;

  for (let i = 0; i < chunks.length; i++) {
    const currentChunk = chunks[i];
    console.log(`\nSending API Call ${i + 1}/${chunks.length} for ${currentChunk.length} billers using services/billavenue...`);

    try {
      const response = await getBillers(currentChunk);

      if (!response || !response.json || !response.json.billerInfoResponse) {
        console.error(`API Call ${i + 1} Failed. Response:`, response);
        console.log("Stopping sync. Check API credentials or daily rate limit.");
        break;
      }

      let fetchedBillers = response.json.billerInfoResponse.biller;
      if (!fetchedBillers) {
        console.error(`API Call ${i + 1} returned no biller metadata.`);
        continue;
      }

      if (!Array.isArray(fetchedBillers)) {
        fetchedBillers = [fetchedBillers];
      }

      console.log(`Received data for ${fetchedBillers.length} billers. Saving to DB...`);

      let batchSuccess = 0;
      for (const b of fetchedBillers) {
        if (!b || !b.billerId) continue;

        b.mdm_fetched = true;
        const { error: updateErr } = await supabase
          .from('billavenue_billers')
          .update({
            biller_name: b.billerName,
            category: b.category || b.billerCategoryName || targetCategory,
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
  console.log(`🎉 Category Sync Completed! Total updated: ${totalUpdated}`);
  console.log("==================================================");
}

// Execution if called from command line
const args = process.argv.slice(2);
const catArg = args.find(a => a.startsWith('--category='))?.split('=')[1];

syncCategoryBillers(catArg).then(() => {
  process.exit(0);
}).catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
