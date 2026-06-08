const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('users_profiles')
      .update({
        role: 'user',
        super_distributor_id: null
      })
      .eq('id', 'usepay_044')
      .select();
    
    if (error) throw error;
    console.log('Successfully updated Ronak Profile:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
