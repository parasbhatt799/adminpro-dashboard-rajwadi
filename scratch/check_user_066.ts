
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data, error } = await supabase.from('users_profiles').select('id, name, firm_name').eq('id', 'usepay_066').single();
  console.log('User Profile usepay_066:', data);
  if (error) console.error('Error:', error);
}

check();
