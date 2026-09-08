-- Fix foreign key constraints for user deletion dynamically
-- This script finds all foreign key constraints referencing public.users_profiles
-- and recreates them with appropriate ON DELETE behaviors:
-- 1. For tables other than users_profiles, it uses ON DELETE CASCADE.
-- 2. For users_profiles itself (self-references like distributor_id, super_distributor_id),
--    it uses ON DELETE SET NULL to avoid cascade deleting child accounts.

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            tc.table_schema, 
            tc.table_name, 
            tc.constraint_name, 
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'users_profiles'
          AND ccu.table_schema = 'public'
    LOOP
        -- 1. Drop existing constraint
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.table_schema, r.table_name, r.constraint_name);
        
        -- 2. Create new constraint with correct delete behavior
        IF r.table_name = 'users_profiles' THEN
            -- For self-references, set to NULL so that deleting a parent distributor/super distributor
            -- doesn't delete all their child distributors/users.
            EXECUTE format(
                'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users_profiles(id) ON DELETE SET NULL', 
                r.table_schema, r.table_name, r.constraint_name, r.column_name
            );
            RAISE NOTICE 'Updated constraint % on table % with ON DELETE SET NULL', r.constraint_name, r.table_name;
        ELSE
            -- For other tables, cascade delete so orphaned details are cleaned up automatically
            EXECUTE format(
                'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users_profiles(id) ON DELETE CASCADE', 
                r.table_schema, r.table_name, r.constraint_name, r.column_name
            );
            RAISE NOTICE 'Updated constraint % on table % with ON DELETE CASCADE', r.constraint_name, r.table_name;
        END IF;
    END LOOP;

    -- Ensure RLS allows deletion for users_profiles (if it's not already enabled)
    ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users_profiles' AND policyname = 'users_profiles_all_access') THEN
        CREATE POLICY "users_profiles_all_access" ON public.users_profiles FOR ALL USING (true);
    END IF;
END $$;
