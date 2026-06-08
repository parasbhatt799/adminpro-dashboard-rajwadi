const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sql_query = `
    -- Drop restrictive RLS policies for bbps_submissions
    DROP POLICY IF EXISTS "bbps_submissions_user_access" ON public.bbps_submissions;
    DROP POLICY IF EXISTS "bbps_submissions_admin_access" ON public.bbps_submissions;

    -- Create public open policy matching other payment and submission tables
    CREATE POLICY "bbps_submissions_all" ON public.bbps_submissions FOR ALL USING (true) WITH CHECK (true);

    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Running SQL to fix RLS policy for bbps_submissions...');
  const { data, error } = await supabase.rpc('execute_sql', { sql_query });

  if (error) {
    console.error('Failed to update policy:', error);
  } else {
    console.log('Successfully updated RLS policy to allow all access! Data:', data);
  }
}

run();
