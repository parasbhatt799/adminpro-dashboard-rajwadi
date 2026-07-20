import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  console.log("Reading CSV...");
  const lines = fs.readFileSync('C:/Users/ADMIN/Downloads/payoutbankid/bankpayout.csv', 'utf8').split('\n');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length >= 4) {
      const bankId = row[1].replace(/"/g, '').trim();
      const bankName = row[2].replace(/"/g, '').trim();
      const bankCode = row[3].replace(/"/g, '').trim();
      if (bankId && bankCode) {
        rows.push({ bank_id: bankId, bank_name: bankName, bank_code: bankCode });
      }
    }
  }

  console.log(`Inserting ${rows.length} rows into Supabase...`);
  // Insert in batches if needed, but 300 rows is small enough for one insert
  const { error } = await supabase.from('camlenio_banks').insert(rows);
  if (error) {
    console.error("Error inserting data:", error);
  } else {
    console.log('Successfully seeded camlenio_banks table!');
  }
}

run();
