const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('--- Inspecting admin_profiles ---');
  const { data: admins, error: errAdmins } = await supabase
    .from('admin_profiles')
    .select('id, name, mobile_number, role, status, onesignal_id');
  if (errAdmins) {
    console.error('Error querying admin_profiles:', errAdmins.message);
  } else {
    console.log('admin_profiles data:', admins);
  }

  console.log('\n--- Inspecting users_profiles with role = admin ---');
  const { data: userAdmins, error: errUserAdmins } = await supabase
    .from('users_profiles')
    .select('id, name, mobile_number, role, status, onesignal_id')
    .eq('role', 'admin');
  if (errUserAdmins) {
    console.error('Error querying users_profiles:', errUserAdmins.message);
  } else {
    console.log('users_profiles admins:', userAdmins);
  }
}

inspect();
