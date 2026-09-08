-- ====================================================================
-- MIGRATION: Add onesignal_id columns for push notifications
-- Run this script in your Supabase SQL Editor to fix the issue.
-- ====================================================================

-- 1. Add onesignal_id column to users_profiles table (for regular users)
ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS onesignal_id TEXT;

-- 2. Add onesignal_id column to admin_profiles table (for admins)
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS onesignal_id TEXT;

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
