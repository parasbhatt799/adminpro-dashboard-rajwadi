import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testDirectFundReq() {
  console.log('Testing direct fund request DB operations...');

  const { data: creds } = await supabaseAdmin
    .from('b2b_api_credentials')
    .select('*')
    .eq('b2b_login_id', 'mahida_1212')
    .single();

  if (!creds) {
    console.error('Agent credentials not found.');
    return;
  }

  // Insert into b2b_fund_requests
  const { data: reqData, error: insertError } = await supabaseAdmin
    .from('b2b_fund_requests')
    .insert({
      agent_id: creds.id,
      amount: 50000,
      utr_number: 'TEST_UTR_ZENOT_API_9988',
      status: 'pending'
    })
    .select('*')
    .single();

  if (insertError) {
    console.error('Insert error:', insertError);
  } else {
    console.log('SUCCESSFULLY INSERTED FUND REQUEST VIA DB:', reqData);

    // Clean up test record
    await supabaseAdmin.from('b2b_fund_requests').delete().eq('id', reqData.id);
    console.log('Test record cleaned up.');
  }
}

testDirectFundReq();
