const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Fetch Ronak's profile
    const { data: ronak, error } = await supabase
      .from('users_profiles')
      .select('*')
      .eq('id', 'usepay_044')
      .single();
    
    if (error) throw error;
    console.log('Ronak Profile:', ronak);

    // 2. Fetch anyone who lists Ronak as distributor or super distributor
    const { data: children, error2 } = await supabase
      .from('users_profiles')
      .select('id, name, role, distributor_id, super_distributor_id')
      .or(`distributor_id.eq.usepay_044,super_distributor_id.eq.usepay_044`);
    
    if (error2) throw error2;
    console.log('Users referencing Ronak as parent:', children);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
