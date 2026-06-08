const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const rowId = 'aca67243-c04f-44d6-a07e-ef3dd3687514';
  
  // 1. Fetch current row
  const { data: row, error: fetchErr } = await supabase
    .from('bbps_submissions')
    .select('*')
    .eq('id', rowId)
    .single();
    
  if (fetchErr) {
    console.error('Fetch failed:', fetchErr);
    return;
  }
  
  // 2. Update date in metadata to Asia/Kolkata time
  const updatedMetadata = {
    ...row.metadata,
    date: new Date(row.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  };
  
  const { data: updated, error: updateErr } = await supabase
    .from('bbps_submissions')
    .update({ metadata: updatedMetadata })
    .eq('id', rowId)
    .select();
    
  if (updateErr) {
    console.error('Update failed:', updateErr);
  } else {
    console.log('Update successful! New metadata:', updated[0].metadata);
  }
}

run();
