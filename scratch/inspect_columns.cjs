const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectColumns() {
  // Query column info from information_schema
  const { data: cols, error } = await supabase.rpc('inspect_table_columns_legacy', {}, { count: 'exact' });
  
  // Wait, let's just query a single row from these tables and print keys, or use a direct SQL if we have an RPC, or just print keys from select('*')
  console.log('--- Printing keys of admin_profiles ---');
  const { data: adminRow } = await supabase.from('admin_profiles').select('*').limit(1);
  if (adminRow && adminRow.length > 0) {
    console.log('admin_profiles columns:', Object.keys(adminRow[0]));
  } else {
    console.log('admin_profiles is empty or query failed.');
  }

  console.log('--- Printing keys of users_profiles ---');
  const { data: userRow } = await supabase.from('users_profiles').select('*').limit(1);
  if (userRow && userRow.length > 0) {
    console.log('users_profiles columns:', Object.keys(userRow[0]));
  } else {
    console.log('users_profiles is empty or query failed.');
  }

  console.log('--- Printing keys of onesignal_settings ---');
  const { data: settingsRow } = await supabase.from('onesignal_settings').select('*').limit(1);
  if (settingsRow && settingsRow.length > 0) {
    console.log('onesignal_settings columns:', Object.keys(settingsRow[0]));
  } else {
    console.log('onesignal_settings is empty or query failed.');
  }
}

inspectColumns();
