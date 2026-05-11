
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data, error } = await supabase
    .from('payment_submissions')
    .select('created_at, status')
    .order('created_at', { ascending: true })
    .limit(10);
  
  if (error) {
    console.error(error);
  } else {
    console.log('Oldest submissions:', data);
  }
}

checkData();
