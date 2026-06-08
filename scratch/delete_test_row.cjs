const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('bbps_submissions').delete().eq('id', '0e15f3d3-d6e3-4d11-bc43-465e391fb7d2');
  console.log('Deleted:', error || data);
}
run();
