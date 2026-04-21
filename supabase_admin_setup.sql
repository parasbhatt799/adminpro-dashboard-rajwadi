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

--------------------------------------------------------------------------------------------------------------------------------------

-- This will remove the "God Mode" protection from the database
DROP TRIGGER IF EXISTS tr_god_admin_protection ON admin_profiles;
DROP FUNCTION IF EXISTS protect_god_admin();

-- 1. Create a function to protect the God Admin
CREATE OR REPLACE FUNCTION protect_god_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the target is the God Admin (7777077377)
  IF (OLD.mobile_number = '7777077377') THEN
    -- Prevent Deletion
    IF (TG_OP = 'DELETE') THEN
      RAISE EXCEPTION 'CRITICAL SECURITY: The God Admin account (7777077377) is permanent and cannot be deleted.';
    END IF;
    
    -- Prevent specific updates (status or role)
    IF (TG_OP = 'UPDATE') THEN
      IF (NEW.status != OLD.status OR NEW.role != OLD.role) THEN
        RAISE EXCEPTION 'CRITICAL SECURITY: The access level and status of the God Admin account (7777077377) are immutable.';
      END IF;
    END IF;
  END IF;
  
  -- If not the God Admin, or not a restricted operation, allow it
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger on the admin_profiles table
DROP TRIGGER IF EXISTS tr_god_admin_protection ON admin_profiles;
CREATE TRIGGER tr_god_admin_protection
BEFORE UPDATE OR DELETE ON admin_profiles
FOR EACH ROW
EXECUTE FUNCTION protect_god_admin();
