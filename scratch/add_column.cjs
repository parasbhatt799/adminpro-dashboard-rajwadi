
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: 'ALTER TABLE qr_history ADD COLUMN IF NOT EXISTS profit_percentage NUMERIC DEFAULT 0;'
  });
  
  if (error) {
    console.error('Error:', error);
    // If RPC doesn't exist, we might have to do it differently
  } else {
    console.log('Success:', data);
  }
}

run();
