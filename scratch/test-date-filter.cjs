const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const startDate = '2026-05-27';
  const endDate = '2026-05-27';

  console.log(`Filtering from ${startDate}T00:00:00 to ${endDate}T23:59:59...`);

  let query = supabase
    .from('bill_submissions')
    .select('id, amount, charges, created_at, status')
    .neq('status', 'rejected')
    .gte('created_at', `${startDate}T00:00:00`)
    .lte('created_at', `${endDate}T23:59:59`)
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${data.length} records in range:`);
    data.forEach(r => {
      console.log(`ID: ${r.id} | Amt: ${r.amount} | Created: ${r.created_at} | Status: ${r.status}`);
    });
  }
}

run();
