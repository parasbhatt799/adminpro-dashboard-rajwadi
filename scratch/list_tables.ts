import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const { data, error } = await supabase
    .from('pg_tables')
    .select('tablename')
    .eq('schemaname', 'public');

  if (error) {
    console.log('Error listing tables (likely permission denied for pg_tables):', error.message);
    // Alternative: try to select from common tables
    const tables = ['users_profiles', 'admin_profiles', 'notifications', 'bill_payments', 'qr_payments', 'user_settings'];
    for (const t of tables) {
      const { error: tErr } = await supabase.from(t).select('count', { count: 'exact', head: true });
      if (!tErr) console.log(`Table exists: ${t}`);
    }
  } else {
    console.log('Tables:', data.map(t => t.tablename));
  }
}

listTables();
