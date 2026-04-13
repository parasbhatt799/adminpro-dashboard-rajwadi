-- Set admin role for the specific mobile number
UPDATE public.users_profiles
SET role = 'admin'
WHERE mobile_number = '8140428671';

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
