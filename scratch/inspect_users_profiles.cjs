const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: users, error } = await supabase
      .from('users_profiles')
      .select('id, name, mobile_number, role, status, distributor_id, super_distributor_id');
    
    if (error) throw error;
    console.log(`Found ${users.length} profiles in users_profiles:`);
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
