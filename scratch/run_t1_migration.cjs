const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key in .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sqlPath = path.join(__dirname, '../add_t_plus_one_qr_payments.sql');
  console.log(`Reading SQL migration from: ${sqlPath}`);
  
  let sql;
  try {
    sql = fs.readFileSync(sqlPath, 'utf8');
  } catch (err) {
    console.error('Failed to read SQL file:', err.message);
    process.exit(1);
  }

  console.log('Deploying SQL to Supabase...');
  try {
    // Try both 'query' and 'sql' parameter names to be absolutely sure
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    
    if (error) {
      console.log('Error with parameter "query", trying parameter "sql_query"...');
      const { data: data2, error: error2 } = await supabase.rpc('execute_sql', { sql_query: sql });
      
      if (error2) {
        console.log('Error with parameter "sql_query", trying parameter "sql"...');
        const { data: data3, error: error3 } = await supabase.rpc('execute_sql', { sql });
        if (error3) {
          throw new Error(`Migration failed: ${error3.message || JSON.stringify(error3)}`);
        } else {
          console.log('Migration deployed successfully using parameter "sql"!', data3);
        }
      } else {
        console.log('Migration deployed successfully using parameter "sql_query"!', data2);
      }
    } else {
      console.log('Migration deployed successfully using parameter "query"!', data);
    }
  } catch (err) {
    console.error('Migration execution failed:', err.message || err);
    process.exit(1);
  }
}

run();
