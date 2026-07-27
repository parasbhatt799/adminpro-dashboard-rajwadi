ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS b2b_login_id TEXT UNIQUE;
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS b2b_password TEXT;
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS billavenue_agent_id TEXT;
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.b2b_api_credentials ALTER COLUMN api_key DROP NOT NULL;
ALTER TABLE public.b2b_api_credentials ALTER COLUMN secret_key DROP NOT NULL;

-- Drop foreign key constraint on agent_id if it exists to fully decouple from users_profiles
ALTER TABLE public.b2b_api_credentials DROP CONSTRAINT IF EXISTS b2b_api_credentials_agent_id_fkey;
ALTER TABLE public.b2b_api_credentials ALTER COLUMN agent_id DROP NOT NULL;

ALTER TABLE public.b2b_api_logs DROP CONSTRAINT IF EXISTS b2b_api_logs_agent_id_fkey;

-- Drop policies that depend on agent_id
DROP POLICY IF EXISTS "Agents can view their own logs" ON public.b2b_api_logs;

-- Change type of agent_id in b2b_api_logs to UUID if it isn't already, so it can reference b2b_api_credentials(id)
ALTER TABLE public.b2b_api_logs ALTER COLUMN agent_id TYPE UUID USING agent_id::uuid;
ALTER TABLE public.b2b_api_logs ADD CONSTRAINT b2b_api_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.b2b_api_credentials(id) ON DELETE SET NULL;

-- Drop existing admin policies that might be checking the wrong table
DROP POLICY IF EXISTS "Admins can manage b2b credentials" ON public.b2b_api_credentials;
DROP POLICY IF EXISTS "Admins can view all b2b logs" ON public.b2b_api_logs;
DROP POLICY IF EXISTS "Agents can view their own credentials" ON public.b2b_api_credentials;
DROP POLICY IF EXISTS "Agents can view their own logs" ON public.b2b_api_logs;

-- Recreate policies to allow full access like the rest of the project (since custom auth is used)
CREATE POLICY "b2b_api_credentials_all" ON public.b2b_api_credentials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "b2b_api_logs_all" ON public.b2b_api_logs FOR ALL USING (true) WITH CHECK (true);
