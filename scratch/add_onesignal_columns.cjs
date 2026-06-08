const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sql = `
    ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS onesignal_id TEXT;
    ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS onesignal_id TEXT;
    NOTIFY pgrst, 'reload schema';
  `;
  
  console.log('Adding onesignal_id columns...');
  
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
    console.log('Columns added successfully and schema reload triggered!');
  } else {
    console.error('Failed to run migration via execute_sql RPC.');
  }
}

run();
