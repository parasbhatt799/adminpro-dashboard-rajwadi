import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserSettingsSchema() {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching data from user_settings:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in user_settings:', Object.keys(data[0]));
  } else {
    console.log('No data in user_settings to check columns.');
  }
}

checkUserSettingsSchema();
