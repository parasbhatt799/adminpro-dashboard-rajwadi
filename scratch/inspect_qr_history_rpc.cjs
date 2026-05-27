const https = require('https');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in env");
  process.exit(1);
}

// Since execute_sql is not available directly, wait...
// Can we get function definitions through OpenAPI, or can we check if there are other ways?
// Wait, is there any custom RPC or table we can query?
// Wait, is there a postgrest schema or can we see what fields are returned by get_qr_history_with_stats?
// Let's write a script to invoke the RPC 'get_qr_history_with_stats' and print a single item to see its structure!

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  try {
    const { data, error } = await supabase.rpc('get_qr_history_with_stats', {
      search_term: '',
      time_start: null,
      time_end: null
    });
    if (error) {
      console.error('Error fetching stats:', error);
    } else {
      console.log('Result sample:', JSON.stringify(data?.[0], null, 2));
    }
  } catch(e) {
    console.error(e);
  }
}

run();
