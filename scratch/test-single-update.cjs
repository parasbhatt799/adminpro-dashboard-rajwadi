const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Testing a single update...');
  const { data: bill, error: fetchErr } = await supabase
    .from('bill_submissions')
    .select('id, charges')
    .eq('status', 'approved')
    .is('admin_share', null)
    .limit(1)
    .single();

  if (fetchErr || !bill) {
    console.error('Fetch error or no bills need update:', fetchErr);
    return;
  }

  console.log('Found bill:', bill);

  console.log('Trying single update...');
  const { data: updated, error: updateErr } = await supabase
    .from('bill_submissions')
    .update({ admin_share: bill.charges })
    .eq('id', bill.id)
    .select('*');

  if (updateErr) {
    console.error('Update error:', updateErr);
  } else {
    console.log('Update success!', updated[0]);
  }
}

run();
