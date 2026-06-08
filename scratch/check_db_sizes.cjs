const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== Checking Table Row Counts ===');
  const tables = ['payment_submissions', 'bill_submissions', 'bbps_submissions', 'payout_submissions', 'users_profiles'];
  
  for (const table of tables) {
    const start = Date.now();
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    const duration = Date.now() - start;
    if (error) {
      console.log(`- ${table}: Error - ${error.message} (${duration}ms)`);
    } else {
      console.log(`- ${table}: ${count} rows (${duration}ms)`);
    }
  }

  console.log('\n=== Checking get_dashboard_stats Execution Time ===');
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  const startRpc = Date.now();
  const { data, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
    p_start_date: startDate,
    p_end_date: endDate
  });
  const durationRpc = Date.now() - startRpc;
  if (rpcError) {
    console.log(`- RPC: Error - ${rpcError.message} (${durationRpc}ms)`);
  } else {
    console.log(`- RPC: Success (${durationRpc}ms)`);
  }
}

run();
