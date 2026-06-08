const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('users_profiles')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    console.log('SAMPLE USER PROFILE ROW:');
    if (data && data.length > 0) {
      console.log(JSON.stringify(data[0], null, 2));
      console.log('\nCOLUMNS:');
      console.log(Object.keys(data[0]));
    } else {
      console.log('No user profiles found.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
