const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sql = `DROP FUNCTION IF EXISTS public.get_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ);`;
  
  // Try parameter name 'sql'
  console.log('Trying with parameter "sql"...');
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql });
    if (error) console.error('Error with "sql":', error);
    else console.log('Success with "sql":', data);
  } catch(e) {
    console.error('Catch "sql":', e);
  }

  // Try parameter name 'sql_query'
  console.log('Trying with parameter "sql_query"...');
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
    if (error) console.error('Error with "sql_query":', error);
    else console.log('Success with "sql_query":', data);
  } catch(e) {
    console.error('Catch "sql_query":', e);
  }

  // Try parameter name 'query_text'
  console.log('Trying with parameter "query_text"...');
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query_text: sql });
    if (error) console.error('Error with "query_text":', error);
    else console.log('Success with "query_text":', data);
  } catch(e) {
    console.error('Catch "query_text":', e);
  }
}

run();
