const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const { data, error } = await supabase.from('qr_settings').select('admin_balance').eq('id', 1).single();
    if (error) {
      console.error(error);
    } else {
      console.log('qr_settings admin_balance:', data.admin_balance);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
