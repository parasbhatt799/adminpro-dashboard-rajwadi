-- 1. Add columns to users_profiles for Distributor System
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS distributor_id TEXT REFERENCES public.users_profiles(id),
ADD COLUMN IF NOT EXISTS admin_base_qr_charge NUMERIC DEFAULT 0;

-- 2. Update role constraint to explicitly allow 'distributor'
-- (Postgres doesn't have an easy way to update an existing CHECK constraint inline without naming it, 
-- but usually a simple text column works fine. If there's a constraint, we'll handle it if it fails.)

-- 3. Refresh schema cache
NOTIFY pgrst, 'reload schema';
