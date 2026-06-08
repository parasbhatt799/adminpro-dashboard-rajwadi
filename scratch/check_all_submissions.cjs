const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('--- Most Recent bbps_submissions ---');
  const { data: bbps } = await supabase.from('bbps_submissions').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('bbps:', bbps);

  console.log('--- Most Recent bill_submissions ---');
  const { data: bill } = await supabase.from('bill_submissions').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('bill:', bill);

  console.log('--- Most Recent payment_submissions ---');
  const { data: pay } = await supabase.from('payment_submissions').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('pay:', pay);
}

run();
