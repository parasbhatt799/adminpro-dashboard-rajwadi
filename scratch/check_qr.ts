
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkQrData() {
  const { data, error } = await supabase
    .from('payment_submissions')
    .select('admin_share, charges')
    .eq('status', 'approved')
    .limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('QR Data:', JSON.stringify(data, null, 2));
  }
}

checkQrData();
