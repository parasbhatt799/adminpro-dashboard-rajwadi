
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  console.log('--- qr_history ---');
  const { data: qrData, error: qrErr } = await supabase.from('qr_history').select('*').limit(1);
  console.log(qrData);
  if (qrErr) console.error(qrErr);

  console.log('--- payment_submissions ---');
  const { data: payData, error: payErr } = await supabase.from('payment_submissions').select('*').limit(1);
  console.log(payData);
  if (payErr) console.error(payErr);
}

check();
