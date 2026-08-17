import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkColumns() {
  console.log('Inspecting latest records in b2b_fund_requests...');

  const { data: reqs, error } = await supabaseAdmin
    .from('b2b_fund_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching fund requests:', error);
    return;
  }

  console.log('Latest 5 Fund Requests:', JSON.stringify(reqs, null, 2));

  // Check b2b_admin_bank_accounts table
  const { data: banks, error: bankErr } = await supabaseAdmin
    .from('b2b_admin_bank_accounts')
    .select('*');

  if (bankErr) {
    console.log('Error fetching b2b_admin_bank_accounts:', bankErr);
  } else {
    console.log('Existing Admin Bank Accounts:', JSON.stringify(banks, null, 2));
  }
}

checkColumns();
