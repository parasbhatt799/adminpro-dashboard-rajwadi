const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sqlPath = path.join(__dirname, '../add_bill_payment_limits.sql');
  const sql_query = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running SQL Migration to add BBPS & Normal Bill Payment daily limits...');
  
  let success = false;
  
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql_query });
    if (error) {
      console.warn('execute_sql with sql_query parameter failed:', error.message);
    } else {
      console.log('Migration successful (via sql_query parameter)!', data);
      success = true;
    }
  } catch (err) {
    console.error('Error with sql_query parameter:', err.message);
  }

  if (!success) {
    try {
      const { data, error } = await supabase.rpc('execute_sql', { sql: sql_query });
      if (error) {
        console.error('execute_sql with sql parameter failed:', error.message);
      } else {
        console.log('Migration successful (via sql parameter)!', data);
        success = true;
      }
    } catch (err) {
      console.error('Error with sql parameter:', err.message);
    }
  }

  if (!success) {
    console.error('All migration attempts failed.');
  }
}

run();
