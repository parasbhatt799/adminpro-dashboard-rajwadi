-- Add wallet_balance column to users_profiles
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
