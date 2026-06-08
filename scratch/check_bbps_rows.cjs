const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('--- Fetching latest bbps_submissions ---');
  const { data, error } = await supabase
    .from('bbps_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Fetch failed:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
