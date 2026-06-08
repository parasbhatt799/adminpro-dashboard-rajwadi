const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sqlPath = path.join(__dirname, '../add_bbps_submissions_schema.sql');
  const sql_query = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running SQL Migration...');
  const { data, error } = await supabase.rpc('execute_sql', { sql_query });

  if (error) {
    console.error('Migration failed:', error);
  } else {
    console.log('Migration successful!', data);
  }
}

run();
