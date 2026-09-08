-- Step 1: Enable Realtime for the admin_profiles table
-- This allows the front-end to listen for changes to roles or blocks
ALTER PUBLICATION supabase_realtime ADD TABLE admin_profiles;

-- Step 2: Ensure the table has 'Full' replication (optional but recommended)
-- This ensures that 'old' values are also available if needed
ALTER TABLE admin_profiles REPLICA IDENTITY FULL;

-- Step 3: Refresh the publication
NOTIFY pgrst, 'reload schema';
