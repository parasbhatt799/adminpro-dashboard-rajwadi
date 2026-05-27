const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getTodayStr = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

async function run() {
  try {
    const startDate = getTodayStr();
    const endDate = getTodayStr();
    console.log('startDate:', startDate);
    console.log('endDate:', endDate);
    
    let query = supabase
      .from('payment_submissions')
      .select('*, users_profiles!inner(name, firm_name, profile_photo_url, distributor_id, charge_percentage, admin_base_qr_charge), qr_history(qr_name, whatsapp_number)', { count: 'exact' });

    if (startDate) {
      const startIso = new Date(startDate).toISOString();
      console.log('startIso:', startIso);
      query = query.gte('created_at', startIso);
    }
    if (endDate) {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const endIso = nextDay.toISOString();
      console.log('endIso:', endIso);
      query = query.lt('created_at', endIso);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    
    console.log('MATCHING COUNT:', count);
    console.log('MATCHING DATA:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();
