const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('--- Testing insert into bbps_submissions ---');
  const payload = {
    user_id: 'usepay_030',
    service_type: 'Electricity',
    provider: 'Torrent Power',
    consumer_number: '100023456',
    amount: 500,
    charges: 10,
    status: 'approved',
    rejection_reason: 'TXN56789012'
  };

  const { data, error } = await supabase.from('bbps_submissions').insert(payload).select();
  if (error) {
    console.error('Insert failed:', error);
  } else {
    console.log('Insert successful! Inserted row columns:', Object.keys(data[0] || {}));
    console.log('Row details:', data[0]);
  }
}

run();
