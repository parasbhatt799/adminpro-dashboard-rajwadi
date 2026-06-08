const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('billavenue_billers')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Database Error:', error.message, 'Code:', error.code);
  } else {
    console.log('Successfully queried table. billavenue_billers exists!');
  }
}

main();
