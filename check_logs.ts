import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkLogs() {
  const { data, error } = await supabaseAdmin
    .from('b2b_api_logs')
    .select('*')
    .eq('endpoint', '/api/b2b/pay-bill')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  console.log('LATEST PAY LOGS:');
  data.forEach((log, index) => {
    console.log('\n--- LOG ' + (index + 1) + ' ---');
    console.log('Time:', log.created_at);
    console.log('Status Code:', log.status_code);
    console.log('Response Status:', log.response_body?.status);
    console.log('Transaction ID:', log.response_body?.transaction_id);
    console.log('Final Status:', log.response_body?.finalStatus);
    if (log.response_body?.error) {
        console.log('Error:', log.response_body.error);
    }
    if (log.response_body?.billPayResponse) {
        console.log('BillAvenue Response:', JSON.stringify(log.response_body.billPayResponse, null, 2));
    }
  });
}

checkLogs();
