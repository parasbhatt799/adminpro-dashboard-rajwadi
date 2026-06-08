const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sqlPath = path.join(__dirname, '..', 'get_optimized_dashboard_data.sql');
  console.log(`Reading SQL from: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Deploying public.get_optimized_dashboard_data via execute_sql...');
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    if (error) {
      console.error('Error deploying function:', error.message);
      process.exit(1);
    } else {
      console.log('Success deploying function! Data returned:', data);
    }
  } catch(e) {
    console.error('Unexpected error:', e);
    process.exit(1);
  }
}

run();
