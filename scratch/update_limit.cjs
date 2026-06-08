const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    const { data, error } = await supabase
      .from('qr_settings')
      .update({ t_plus_one_limit: 20000 })
      .eq('id', 1)
      .select();

    if (error) {
      console.error('Update failed:', error.message);
    } else {
      console.log('Update success! New data:', JSON.stringify(data, null, 2));
    }
  } catch(e) {
    console.error('Error:', e);
  }
}

main();
