const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  try {
    const sqlPath = path.join(__dirname, 'create_fund_transfer_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running SQL Migration...');
    let success = false;
    
    // Try with sql_query parameter
    try {
      const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
      if (error) {
        console.warn('execute_sql with sql_query failed:', error.message);
      } else {
        console.log('execute_sql with sql_query succeeded:', data);
        success = true;
      }
    } catch(e) {
      console.error('Catch sql_query error:', e);
    }

    if (!success) {
      // Try with sql parameter
      try {
        const { data, error } = await supabase.rpc('execute_sql', { sql: sql });
        if (error) {
          console.error('execute_sql with sql failed:', error.message);
        } else {
          console.log('execute_sql with sql succeeded:', data);
          success = true;
        }
      } catch(e) {
        console.error('Catch sql error:', e);
      }
    }

    if (success) {
      console.log('Migration completed successfully!');
    } else {
      console.error('Migration failed.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Migration script failed:', err);
    process.exit(1);
  }
}

run();
