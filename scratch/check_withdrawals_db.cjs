const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWithdrawals() {
  try {
    const { data, error } = await supabase
      .from('distributor_withdrawals')
      .select('*, users_profiles(name, firm_name, role, super_distributor_id)');
    
    if (error) throw error;

    console.log("Total withdrawals in database:", data ? data.length : 0);
    console.log("Withdrawals list:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error checking table:", err);
  }
}

checkWithdrawals();
