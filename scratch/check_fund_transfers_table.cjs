const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    const { data, error } = await supabase
      .from('fund_transfers')
      .select('*')
      .limit(1);

    if (error) {
      console.log('fund_transfers check failed:', error.message, 'Code:', error.code);
    } else {
      console.log('fund_transfers table exists!');
    }
  } catch(e) {
    console.error('Error:', e);
  }
}

main();
