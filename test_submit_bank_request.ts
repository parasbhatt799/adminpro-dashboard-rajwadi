import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testSubmitBankReq() {
  console.log('Testing submission with Admin Bank Account...');

  // Get active bank account
  const { data: bank } = await supabaseAdmin
    .from('b2b_admin_bank_accounts')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!bank) {
    console.error('No active bank found.');
    return;
  }

  // Get agent credentials
  const { data: agent } = await supabaseAdmin
    .from('b2b_api_credentials')
    .select('*')
    .eq('b2b_login_id', 'mahida_1212')
    .single();

  if (!agent) {
    console.error('No agent found.');
    return;
  }

  console.log('Selected Bank for test:', bank.bank_name, bank.account_number);

  const { data: req, error } = await supabaseAdmin
    .from('b2b_fund_requests')
    .insert({
      agent_id: agent.id,
      amount: 500,
      utr_number: 'TEST_UTR_BANK_DETAILS_778899',
      status: 'pending',
      admin_bank_account_id: bank.id,
      admin_bank_details: {
        bank_name: bank.bank_name,
        account_name: bank.account_name,
        account_number: bank.account_number,
        ifsc_code: bank.ifsc_code,
        upi_id: bank.upi_id || null
      }
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error inserting test request:', error);
  } else {
    console.log('SUCCESS! Test Request Inserted:', req);
  }
}

testSubmitBankReq();
