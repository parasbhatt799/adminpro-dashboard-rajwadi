const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sqlPath = path.join(__dirname, '..', 'get_optimized_dashboard_data.sql');
  console.log(`Reading SQL from: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // We try different parameter names for execute_sql RPC
  const paramsToTry = [
    { sql: sql },
    { sql_query: sql },
    { query_text: sql }
  ];

  for (const params of paramsToTry) {
    const paramName = Object.keys(params)[0];
    console.log(`Trying to deploy using execute_sql with parameter "${paramName}"...`);
    try {
      const { data, error } = await supabase.rpc('execute_sql', params);
      if (error) {
        console.error(`Failed with "${paramName}":`, error.message);
      } else {
        console.log(`Success deploying function with parameter "${paramName}"! Data returned:`, data);
        return;
      }
    } catch(e) {
      console.error(`Catch with "${paramName}":`, e);
    }
  }

  console.error('All deployment attempts failed.');
  process.exit(1);
}

run();
