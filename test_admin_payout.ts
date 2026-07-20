import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: txData, error: txError } = await supabase
    .from('payout_submissions')
    .select('*, users_profiles(name, mobile_number)')
    .in('status', ['approved', 'pending', 'processing', 'rejected', 'refunded'])
    .order('created_at', { ascending: false });

  if (txError) {
    console.error('TX Error:', txError);
  } else {
    console.log('TX Data:', txData?.length);
  }

  const { data: settingsData, error: settingsError } = await supabase
    .from('payout_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (settingsError) {
    console.error('Settings Error:', settingsError);
  } else {
    console.log('Settings Data:', settingsData);
  }
}
test();
