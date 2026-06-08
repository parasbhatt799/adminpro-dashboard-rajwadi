const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('bbps_submissions')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error querying bbps_submissions:', error.message);
  } else {
    console.log('Successfully queried bbps_submissions! Table exists. Data:', data);
  }
}

check();
