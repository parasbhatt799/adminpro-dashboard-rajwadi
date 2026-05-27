const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error, count } = await supabase
      .from('payment_submissions')
      .select('*, users_profiles!inner(name, firm_name, profile_photo_url, distributor_id, charge_percentage, admin_base_qr_charge), qr_history(qr_name, whatsapp_number)', { count: 'exact' });
    
    if (error) {
      console.error('JOIN QUERY FAILED:', error);
    } else {
      console.log('JOIN QUERY SUCCESS, COUNT:', count);
      console.log('DATA SAMPLES:', JSON.stringify(data.slice(0, 2), null, 2));
    }
  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();
