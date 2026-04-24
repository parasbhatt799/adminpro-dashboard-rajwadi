
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkData() {
  const { data, error } = await supabase
    .from('bill_submissions')
    .select('*, users_profiles(firm_name)')
    .eq('status', 'approved')
    .gte('created_at', '2026-04-24T00:00:00Z')
    .lte('created_at', '2026-04-24T23:59:59Z');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Bill Data (April 24):', JSON.stringify(data, null, 2));
    console.log('Count:', data.length);
  }
}

checkData();
