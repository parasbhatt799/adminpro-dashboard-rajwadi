const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('qr_settings').select('*').eq('id', 1).single();
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("qr_settings record:", JSON.stringify(data, null, 2));
  }
}

run();
