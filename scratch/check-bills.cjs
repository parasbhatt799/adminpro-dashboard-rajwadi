const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data: bills, error } = await supabase
      .from('bill_submissions')
      .select('id, amount, charges, status, admin_share, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching bills:', error);
    } else {
      console.log('Last 10 Bill Submissions:');
      bills.forEach(b => {
        console.log(`ID: ${b.id} | Amt: ${b.amount} | Charges: ${b.charges} | Admin Share: ${b.admin_share} | Status: ${b.status} | Created: ${b.created_at}`);
      });
    }

    // Run get_dashboard_stats for today to compare
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    const { data: stats, error: statsError } = await supabase.rpc('get_dashboard_stats', {
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (statsError) {
      console.error('RPC Error:', statsError);
    } else {
      console.log('Today Stats:', stats);
    }
  } catch (err) {
    console.error('Caught error:', err);
  }
}

run();
