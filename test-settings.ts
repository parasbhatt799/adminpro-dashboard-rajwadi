import { supabase } from './src/lib/supabase';
async function test() {
  const { data, error } = await supabase.from('payout_settings').select('*');
  console.log('SELECT:', data, error);
  const { data: updateData, error: updateError } = await supabase.from('payout_settings').update({ camlenio_max_payout: 50000 }).eq('id', 1).select();
  console.log('UPDATE:', updateData, updateError);
}
test();
