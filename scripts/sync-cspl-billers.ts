import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function syncBillers() {
  const csvPath = 'C:\\Users\\ADMIN\\Downloads\\biller list\\bbps_billers_list 1 (2).csv';
  console.log(`Reading CSV from ${csvPath}`);

  const csvData = fs.readFileSync(csvPath, 'utf8');
  const lines = csvData.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  // id,biller_id,biller_name,biller_category,blr_coverage,biller_status
  // find indexes
  const idIdx = headers.indexOf('biller_id');
  const nameIdx = headers.indexOf('biller_name');
  const catIdx = headers.indexOf('biller_category');
  const covIdx = headers.indexOf('blr_coverage');
  const statIdx = headers.indexOf('biller_status');

  console.log(`Found headers: ID=${idIdx}, NAME=${nameIdx}, CAT=${catIdx}, COV=${covIdx}, STAT=${statIdx}`);

  const billers = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple split by comma, ignoring commas inside quotes is better with regex:
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    if (cols.length > Math.max(idIdx, nameIdx, catIdx)) {
      const biller_id = cols[idIdx]?.replace(/^"|"$/g, '').trim();
      const biller_name = cols[nameIdx]?.replace(/^"|"$/g, '').trim();
      const category = cols[catIdx]?.replace(/^"|"$/g, '').trim();
      const biller_coverage = cols[covIdx]?.replace(/^"|"$/g, '').trim() || '';
      const status = cols[statIdx]?.replace(/^"|"$/g, '').trim() || 'ACTIVE';

      if (biller_id && biller_name) {
        billers.push({
          biller_id,
          biller_name,
          category,
          biller_coverage,
          status,
          metadata: { imported_from: 'CSV', provider: 'Camlenio' }
        });
      }
    }
  }

  console.log(`Parsed ${billers.length} valid billers.`);

  console.log('Truncating cspl_billers table...');
  const { error: truncErr } = await supabaseAdmin.from('cspl_billers').delete().neq('biller_id', 'dummy');
  if (truncErr) {
      console.error('Error truncating table:', truncErr);
  }

  console.log('Inserting billers in batches of 500...');
  for (let i = 0; i < billers.length; i += 500) {
    const batch = billers.slice(i, i + 500);
    const { error } = await supabaseAdmin.from('cspl_billers').insert(batch);
    if (error) {
      console.error(`Error inserting batch ${i}:`, error.message);
    } else {
      process.stdout.write(`\rInserted ${Math.min(i + 500, billers.length)} / ${billers.length}`);
    }
  }

  console.log('\nSync complete!');
}

syncBillers().catch(console.error);
