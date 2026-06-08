const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const startDate = '2026-05-31';
  const endDate = '2026-05-31';

  console.log('--- METHOD 1: ISOString ---');
  const isoGte = new Date(`${startDate}T00:00:00`).toISOString();
  const isoLte = new Date(`${endDate}T23:59:59.999`).toISOString();
  console.log(`isoGte: ${isoGte}, isoLte: ${isoLte}`);
  const { data: data1, error: err1 } = await supabase
    .from('bbps_submissions')
    .select('*')
    .gte('created_at', isoGte)
    .lte('created_at', isoLte);
  
  if (err1) console.error('Method 1 error:', err1);
  else console.log(`Method 1 returned ${data1.length} rows`);

  console.log('--- METHOD 2: Direct String ---');
  const strGte = `${startDate}T00:00:00`;
  const strLte = `${endDate}T23:59:59`;
  console.log(`strGte: ${strGte}, strLte: ${strLte}`);
  const { data: data2, error: err2 } = await supabase
    .from('bbps_submissions')
    .select('*')
    .gte('created_at', strGte)
    .lte('created_at', strLte);

  if (err2) console.error('Method 2 error:', err2);
  else console.log(`Method 2 returned ${data2.length} rows`);
}

run();
