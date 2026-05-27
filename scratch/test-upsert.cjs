const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Fetch one row
  const { data: before, error: fetchErr } = await supabase
    .from('bill_submissions')
    .select('*')
    .eq('status', 'approved')
    .is('admin_share', null)
    .limit(1)
    .single();

  if (fetchErr || !before) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  console.log('Row before upsert:', before);

  // Try upserting with only id and admin_share (set to charges)
  const upsertObj = {
    id: before.id,
    admin_share: before.charges
  };

  const { data: afterUpsert, error: upsertErr } = await supabase
    .from('bill_submissions')
    .upsert(upsertObj)
    .select('*')
    .single();

  if (upsertErr) {
    console.error('Upsert error:', upsertErr);
  } else {
    console.log('Row after upsert:', afterUpsert);
  }
}

run();
