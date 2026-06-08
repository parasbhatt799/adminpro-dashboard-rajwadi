const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://malrqshegrrovyrhflup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbHJxc2hlZ3Jyb3Z5cmhmbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjI4MzYsImV4cCI6MjA5MTgzODgzNn0.6oenVFgz-d8jXgoRzhDY3y6Cmz5N6JK7YdxXxDbQe8Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase
    .from('billavenue_billers')
    .select('biller_id, biller_name, category, metadata');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('--- ALL STAGING BILLERS ---');
  data.forEach((d, idx) => {
    console.log(`\n${idx+1}. Biller Name: ${d.biller_name}`);
    console.log(`   Biller ID: ${d.biller_id}`);
    console.log(`   Category: ${d.category}`);
    console.log(`   Input Params:`, JSON.stringify(d.metadata?.inputParams || d.metadata?.input || {}, null, 2));
  });
}

main().catch(console.error);
