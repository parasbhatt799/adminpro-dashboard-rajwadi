const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error, count } = await supabase
    .from('bill_submissions')
    .select('id, amount, charges, admin_share', { count: 'exact' })
    .eq('status', 'approved')
    .is('admin_share', null);

  if (error) {
    console.error('Error fetching:', error);
  } else {
    console.log(`Found ${count} approved bills with null admin_share.`);
    console.log('Sample rows:', data.slice(0, 5));
  }
}

run();
