const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const now = new Date();
    // Default range is today
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    console.log('p_start_date:', startDate);
    console.log('p_end_date:', endDate);

    const { data, error } = await supabase.rpc('get_dashboard_stats', {
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) {
      console.error('RPC Error:', error);
    } else {
      console.log('RPC Success Data:', data);
    }
  } catch (err) {
    console.error('Caught error:', err);
  }
}

run();
