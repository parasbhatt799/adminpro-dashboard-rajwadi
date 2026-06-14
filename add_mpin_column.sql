-- SQL migration to add 6-digit Login MPIN column to users_profiles table
ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS mpin VARCHAR(6);
