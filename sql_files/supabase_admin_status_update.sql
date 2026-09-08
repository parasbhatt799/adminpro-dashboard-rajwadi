-- Add status column to admin_profiles table
ALTER TABLE public.admin_profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Blocked'));

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
