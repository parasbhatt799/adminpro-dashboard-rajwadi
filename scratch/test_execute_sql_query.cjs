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
  
  console.log('Trying execute_sql with parameter "query"...');
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    if (error) {
      console.error('Error with "query":', error.message);
    } else {
      console.log('Success with "query":', data);
    }
  } catch(e) {
    console.error('Catch error:', e);
  }
}

run();
