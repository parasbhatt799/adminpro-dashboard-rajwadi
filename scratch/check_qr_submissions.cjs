const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error } = await supabase
      .from('payment_submissions')
      .select('id, qr_id, qr_history(qr_name)')
      .eq('status', 'approved');

    if (error) throw error;

    console.log('Total approved submissions:', data.length);
    const groups = {};
    data.forEach(sub => {
      const qrId = sub.qr_id || 'legacy';
      const qrName = sub.qr_history?.qr_name || 'Legacy QR';
      if (!groups[qrId]) {
        groups[qrId] = {
          name: qrName,
          count: 0
        };
      }
      groups[qrId].count++;
    });

    console.log('QR Code Groups:', groups);
  } catch (err) {
    console.error(err);
  }
}

run();
