-- Add permissions column to admin_profiles table
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- Update existing 'full' admins to have all permissions if desired, 
-- or leave them as 'full' and handle 'full' role as 'all permissions' in code.
-- The current plan handles 'full' role as 'all access' in code.
