const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  try {
    // We can query the information_schema via a RPC if execute_sql exists.
    // Let's test if execute_sql exists by running a simple query.
    const query = `
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name='users_profiles';
    `;
    
    const { data, error } = await supabase.rpc('execute_sql', { sql: query });
    if (error) {
      console.error("RPC Error:", error);
      // Let's try with sql_query parameter
      const { data: data2, error: error2 } = await supabase.rpc('execute_sql', { sql_query: query });
      if (error2) {
        console.error("RPC Error (sql_query):", error2);
      } else {
        console.log("Foreign keys referencing users_profiles:");
        console.log(data2);
      }
    } else {
      console.log("Foreign keys referencing users_profiles:");
      console.log(data);
    }
  } catch (e) {
    console.error(e);
  }
}

run();
