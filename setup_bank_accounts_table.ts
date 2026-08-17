import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function setupBankTable() {
  console.log('Testing b2b_admin_bank_accounts table existence in DB...');

  const { data, error } = await supabaseAdmin
    .from('b2b_admin_bank_accounts')
    .select('*')
    .limit(1);

  if (error && error.code === 'PGRST205') {
    console.log('Table b2b_admin_bank_accounts does not exist yet.');
  } else if (error) {
    console.log('QueryResult error:', error);
  } else {
    console.log('Table b2b_admin_bank_accounts exists!');
  }
}

setupBankTable();
