const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('--- FETCHING PENDING SUBMISSIONS ---');
  const { data: sub, error: subErr } = await supabase
    .from('payment_submissions')
    .select('*')
    .eq('status', 'pending');
  
  if (subErr) {
    console.error('Error fetching submissions:', subErr);
    return;
  }
  
  console.log('Submissions count:', sub.length);
  console.log('Submissions:', JSON.stringify(sub, null, 2));

  for (const s of sub) {
    console.log(`\nChecking user_id: ${s.user_id}`);
    const { data: profile, error: profErr } = await supabase
      .from('users_profiles')
      .select('*')
      .eq('id', s.user_id);
    
    if (profErr) {
      console.error('Error fetching profile:', profErr);
    } else {
      console.log('Profile found:', JSON.stringify(profile, null, 2));
    }

    if (s.qr_id) {
      console.log(`Checking qr_id: ${s.qr_id}`);
      const { data: qr, error: qrErr } = await supabase
        .from('qr_history')
        .select('*')
        .eq('id', s.qr_id);
      if (qrErr) {
        console.error('Error fetching qr:', qrErr);
      } else {
        console.log('QR found:', JSON.stringify(qr, null, 2));
      }
    }
  }

  console.log('\n--- TESTING JOIN QUERY ---');
  const { data: joinData, error: joinErr } = await supabase
    .from('payment_submissions')
    .select('*, users_profiles!inner(name, firm_name, profile_photo_url, distributor_id, charge_percentage, admin_base_qr_charge), qr_history(qr_name, whatsapp_number)')
    .eq('status', 'pending');
  
  if (joinErr) {
    console.error('Join query error:', joinErr);
  } else {
    console.log('Join query results:', JSON.stringify(joinData, null, 2));
  }
}

main().catch(console.error);
