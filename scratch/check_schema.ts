
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching admin_profiles:', error);
  } else {
    console.log('Admin Profile keys:', data.length > 0 ? Object.keys(data[0]) : 'No data');
  }
}

checkSchema();
