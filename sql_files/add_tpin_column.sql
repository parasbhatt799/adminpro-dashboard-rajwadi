-- Add TPIN Column to users_profiles table
ALTER TABLE public.users_profiles
ADD COLUMN IF NOT EXISTS tpin TEXT DEFAULT NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
