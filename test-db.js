const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('payment_submissions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    console.log('PAYMENT SUBMISSIONS:', JSON.stringify(data, null, 2));

    const { data: users, error: userError } = await supabase
      .from('users_profiles')
      .select('id, name, firm_name, role');
    if (userError) throw userError;
    console.log('USER PROFILES:', JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error running db test:', err);
  }
}

run();
