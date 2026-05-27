const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { count, error } = await supabase
      .from('payment_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    if (error) throw error;
    console.log('SIDEBAR PENDING COUNT:', count);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
