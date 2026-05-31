-- Add TPIN lockout fields to users_profiles
ALTER TABLE public.users_profiles
ADD COLUMN IF NOT EXISTS tpin_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tpin_locked_until TIMESTAMPTZ DEFAULT NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
