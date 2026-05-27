const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
            event_object_table AS table_name,
            trigger_name,
            event_manipulation AS event,
            action_statement AS statement,
            action_timing AS timing
        FROM information_schema.triggers
        ORDER BY event_object_table;
      `
    });

    if (error) {
      // If execute_sql doesn't work, maybe we can run another way or execute_sql is named differently
      console.error('Error fetching triggers:', error);
    } else {
      console.log('Triggers found:', data);
    }
  } catch (err) {
    console.error('Caught error:', err);
  }
}

run();
