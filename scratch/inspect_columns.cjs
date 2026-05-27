const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  try {
    // Query table columns using a query or RPC. Wait, we can run a SELECT on the table, or check columns.
    // Let's do a SELECT * LIMIT 1, but we already did that and got no status column.
    // Let's query information_schema.columns:
    // We don't have execute_sql RPC unless it's defined, but we can call a query. Wait!
    // Can we run a raw SQL query or check if there is an RPC we can use?
    // Wait, let's just query a single row and see all keys of the returned object:
    const { data, error } = await supabase.from('admin_withdrawals').select('*').limit(1);
    if (error) {
      console.error(error);
    } else {
      console.log('Keys in admin_withdrawals:', Object.keys(data[0] || {}));
      console.log('Row:', data[0]);
    }
  } catch (e) {
    console.error(e);
  }
}

run();
