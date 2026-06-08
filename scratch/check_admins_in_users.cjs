const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: userAdmins, error } = await supabase
    .from('users_profiles')
    .select('id, name, mobile_number, role, status')
    .eq('role', 'admin');

  if (error) {
    console.error('Error querying users_profiles:', error.message);
  } else {
    console.log('Admins found in users_profiles:', userAdmins);
  }

  const { data: allAdmins, error2 } = await supabase
    .from('admin_profiles')
    .select('id, name, mobile_number, role, status');

  if (error2) {
    console.error('Error querying admin_profiles:', error2.message);
  } else {
    console.log('Admins found in admin_profiles:', allAdmins);
  }
}

run();
