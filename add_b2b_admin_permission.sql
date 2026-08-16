-- Migration to add B2B Admin permission flag to admin_profiles table
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS is_b2b_admin BOOLEAN DEFAULT TRUE;
