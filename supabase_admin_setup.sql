-- 1. Create the admin_profiles table
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mobile_number text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Insert the current hardcoded admin credentials
-- NOTE: Please change the password in Supabase after running this for better security.
INSERT INTO public.admin_profiles (mobile_number, password)
VALUES ('8140428671', 'admin123')
ON CONFLICT (mobile_number) DO NOTHING;

-- 3. Enable Row Level Security
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create a policy to allow public reads for the login feature
-- Since this is for a high-priority dashboard, we'll allow public select on just the ID and credentials
-- for the login page to verify.
CREATE POLICY "Enable read access for login" ON public.admin_profiles
FOR SELECT USING (true);

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload schema';
