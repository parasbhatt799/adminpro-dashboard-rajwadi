import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = fs.readFileSync('refund_payout.sql', 'utf8');

supabase.rpc('exec_sql', { sql_query: sql }).then(res => {
  if (res.error) console.error("RPC exec_sql failed (maybe it's not defined?):", res.error);
  else console.log("Success with exec_sql");
});
