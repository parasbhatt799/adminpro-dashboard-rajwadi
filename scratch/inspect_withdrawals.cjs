const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  try {
    console.log('--- ADMIN WITHDRAWALS ---');
    const { data: adminData, error: adminErr } = await supabase
      .from('admin_withdrawals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (adminErr) {
      console.error(adminErr);
    } else {
      console.log(adminData);
    }

    console.log('--- DISTRIBUTOR WITHDRAWALS ---');
    const { data: distData, error: distErr } = await supabase
      .from('distributor_withdrawals')
      .select('*')
      .order('created_at', { ascending: false });

    if (distErr) {
      console.error(distErr);
    } else {
      console.log(distData);
    }

  } catch(e) {
    console.error(e);
  }
}

run();
