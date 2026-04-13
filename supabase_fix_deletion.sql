-- Fix foreign key constraints for user deletion
-- This script adds ON DELETE CASCADE to tables that reference users_profiles
-- so that when a user is deleted, their associated submissions are also deleted.

DO $$ 
BEGIN
    -- Fix bill_submissions
    -- We attempt to drop the constraint and recreate it with ON DELETE CASCADE
    -- The constraint name is likely 'bill_submissions_user_id_fkey'
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'bill_submissions' AND constraint_name = 'bill_submissions_user_id_fkey') THEN
        ALTER TABLE public.bill_submissions DROP CONSTRAINT bill_submissions_user_id_fkey;
        ALTER TABLE public.bill_submissions ADD CONSTRAINT bill_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_profiles(id) ON DELETE CASCADE;
    END IF;

    -- Fix payment_submissions
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'payment_submissions' AND constraint_name = 'payment_submissions_user_id_fkey') THEN
        ALTER TABLE public.payment_submissions DROP CONSTRAINT payment_submissions_user_id_fkey;
        ALTER TABLE public.payment_submissions ADD CONSTRAINT payment_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_profiles(id) ON DELETE CASCADE;
    END IF;

    -- Fix kyc_submissions (already handled in setup, but ensuring here)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'kyc_submissions' AND constraint_name = 'kyc_submissions_user_id_fkey') THEN
        ALTER TABLE public.kyc_submissions DROP CONSTRAINT kyc_submissions_user_id_fkey;
        ALTER TABLE public.kyc_submissions ADD CONSTRAINT kyc_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_profiles(id) ON DELETE CASCADE;
    END IF;

    -- Ensure RLS allows deletion for users_profiles
    -- We enable RLS and add a policy that allows all operations (since it's an admin-heavy app)
    -- or you can restrict it to authenticated users.
    ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users_profiles' AND policyname = 'users_profiles_all_access') THEN
        CREATE POLICY "users_profiles_all_access" ON public.users_profiles FOR ALL USING (true);
    END IF;
END $$;
