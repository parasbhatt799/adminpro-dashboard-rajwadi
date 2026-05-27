const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ikqxqyktshrruhyamknp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcXhxeWt0c2hycnVoeWFta25wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE5NzQ0MiwiZXhwIjoyMDk0NzczNDQyfQ.crQ85MPuJUoRTTDZRjPEyXhNo2nuu-h5eXuDxU7MLUA';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  try {
    const query = `
      DROP FUNCTION IF EXISTS public.get_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ);
    `;
    console.log('Trying with parameter name "query"...');
    const { data, error } = await supabase.rpc('execute_sql', {
      query: query
    });

    if (error) {
      console.error('Error with "query":', error);
    } else {
      console.log('Success with "query":', data);
    }
  } catch (err) {
    console.error('Caught error:', err);
  }
}

run();
