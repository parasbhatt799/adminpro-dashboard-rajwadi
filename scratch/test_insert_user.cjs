const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const testUserData = {
      name: 'TEST USER AGENT',
      email: 'testagent' + Math.floor(Math.random() * 100000) + '@example.com',
      mobile_number: '99999' + Math.floor(10000 + Math.random() * 90000),
      home_address: '123 TEST ST',
      firm_name: 'TEST FIRM',
      firm_address: '456 TEST RD',
      charge_percentage: 1.5,
      status: 'Active',
      role: 'user',
      admin_base_qr_charge: 0,
      distributor_id: null,
      super_distributor_id: null,
      service_charge_enabled: false,
      custom_service_charge: 0,
      password: 'TestPassword123',
      must_change_password: true,
      kyc_status: 'pending'
    };

    console.log('Inserting test user data:', testUserData);
    const { data, error } = await supabase
      .from('users_profiles')
      .insert([testUserData])
      .select();

    if (error) {
      console.error('Insert error:', error);
    } else {
      console.log('Insert success! Inserted row:', JSON.stringify(data, null, 2));
      // Delete the test user
      if (data && data[0]) {
        const { error: delErr } = await supabase
          .from('users_profiles')
          .delete()
          .eq('id', data[0].id);
        if (delErr) {
          console.error('Clean up delete error:', delErr);
        } else {
          console.log('Cleaned up test user successfully.');
        }
      }
    }
  } catch (err) {
    console.error('Exception caught:', err);
  }
}

run();
