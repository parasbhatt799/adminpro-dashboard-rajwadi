
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const { data, error } = await supabase.from('users_profiles').select('*').eq('mobile_number', '8140428671').single();
  console.log('Admin User Profile Data:', data);
  if (error) console.error('Error:', error);
}

check();
