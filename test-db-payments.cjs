const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('payment_submissions')
      .select('*')
      .eq('status', 'pending');
    
    if (error) throw error;
    console.log('PENDING PAYMENTS:', JSON.stringify(data, null, 2));

    if (data && data.length > 0) {
      for (const pay of data) {
        const { data: user, error: userError } = await supabase
          .from('users_profiles')
          .select('*')
          .eq('id', pay.user_id)
          .single();
        if (userError) {
          console.log(`NO USER PROFILE FOUND FOR ID: ${pay.user_id}`);
        } else {
          console.log(`USER FOR ID ${pay.user_id}:`, JSON.stringify(user, null, 2));
        }
      }
    }
  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();
