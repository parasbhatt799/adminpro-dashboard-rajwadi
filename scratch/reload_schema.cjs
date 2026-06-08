const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sql = `NOTIFY pgrst, 'reload schema';`;
  console.log('Sending schema reload notify with sql_query parameter...');
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
    if (error) {
      console.error('Error with sql_query:', error);
    } else {
      console.log('Success with sql_query:', data);
    }
  } catch(e) {
    console.error('Catch sql_query:', e);
  }

  console.log('Sending schema reload notify with sql parameter...');
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql: sql });
    if (error) {
      console.error('Error with sql:', error);
    } else {
      console.log('Success with sql:', data);
    }
  } catch(e) {
    console.error('Catch sql:', e);
  }
}

run();
