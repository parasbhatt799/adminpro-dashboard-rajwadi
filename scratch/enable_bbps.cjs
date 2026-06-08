const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function enable() {
  const { data, error } = await supabase
    .from('qr_settings')
    .update({ is_bbps_enabled: true })
    .eq('id', 1);

  if (error) {
    console.error('Error enabling BBPS:', error);
  } else {
    console.log('BBPS enabled successfully! Result:', data);
  }
}

enable().catch(console.error);
