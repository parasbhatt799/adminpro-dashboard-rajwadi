const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('qr_settings')
    .select('is_bbps_enabled')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('Error fetching qr_settings:', error);
  } else {
    console.log('qr_settings values:', data);
  }
}

check().catch(console.error);
