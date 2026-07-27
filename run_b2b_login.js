import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = fs.readFileSync('b2b_login.sql', 'utf8');

supabase.rpc('exec_sql', { sql_query: sql }).then(res => {
  if (res.error) console.error("Error executing SQL:", res.error);
  else console.log("Successfully added columns");
});
