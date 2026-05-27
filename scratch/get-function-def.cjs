const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sql = `
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name = 'approve_bill_payment_atomic';
  `;
  
  const { data, error } = await supabase.rpc('execute_sql', { query: sql });
  if (error) {
    console.error('Error fetching function definition:', error);
  } else {
    console.log('Function Definition Results:', JSON.stringify(data, null, 2));
  }
}

run();
