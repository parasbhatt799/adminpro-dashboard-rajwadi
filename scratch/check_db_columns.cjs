const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from('qr_settings')
      .select('*')
      .limit(1);
    
    if (settingsError) throw settingsError;
    console.log('QR SETTINGS COLUMNS:', Object.keys(settings[0] || {}));

    const { data: users, error: userError } = await supabase
      .from('users_profiles')
      .select('*')
      .limit(1);
    if (userError) throw userError;
    console.log('USER PROFILES COLUMNS:', Object.keys(users[0] || {}));
  } catch (err) {
    console.error('Error running check:', err);
  }
}

run();
