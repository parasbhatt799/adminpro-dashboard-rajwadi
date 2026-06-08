const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function test() {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  console.log('Testing public.get_optimized_dashboard_data RPC...');
  try {
    const { data, error } = await supabase.rpc('get_optimized_dashboard_data', {
      p_start_date: startDate,
      p_end_date: endDate
    });
    if (error) {
      console.log('RPC Call Error:', error.message, error.code);
    } else {
      console.log('RPC Call Success! Returned data fields:', Object.keys(data));
      console.log('Current stats:', JSON.stringify(data.current_stats, null, 2));
    }
  } catch(e) {
    console.error('Catch error:', e);
  }
}

test();
