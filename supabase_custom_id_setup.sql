-- 1. Create a sequence for the numeric part of the ID
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 1;

-- 2. Create the generator function
CREATE OR REPLACE FUNCTION generate_user_id() RETURNS TEXT AS $$
BEGIN
    RETURN 'usepay_' || LPAD(nextval('user_id_seq')::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Drop all foreign keys referencing users_profiles(id)
-- We'll also drop indices and RLS policies that might be tied to the UUID type
DO $$ 
BEGIN
    -- 1. Drop Policies that depend on the ID column
    DROP POLICY IF EXISTS "bill_submissions_user_access" ON public.bill_submissions;
    DROP POLICY IF EXISTS "bill_submissions_admin_access" ON public.bill_submissions;
    DROP POLICY IF EXISTS "payment_submissions_user_access" ON public.payment_submissions;
    DROP POLICY IF EXISTS "payment_submissions_admin_access" ON public.payment_submissions;
    DROP POLICY IF EXISTS "kyc_submissions_owner_read" ON public.kyc_submissions;
    DROP POLICY IF EXISTS "kyc_submissions_owner_insert" ON public.kyc_submissions;
    DROP POLICY IF EXISTS "kyc_submissions_admin_all" ON public.kyc_submissions;

    -- 2. Drop Foreign Key Constraints
    ALTER TABLE IF EXISTS public.kyc_submissions DROP CONSTRAINT IF EXISTS kyc_submissions_user_id_fkey;
    ALTER TABLE IF EXISTS public.bill_submissions DROP CONSTRAINT IF EXISTS bill_submissions_user_id_fkey;
    ALTER TABLE IF EXISTS public.payment_submissions DROP CONSTRAINT IF EXISTS payment_submissions_user_id_fkey;
    ALTER TABLE IF EXISTS public.complaints DROP CONSTRAINT IF EXISTS complaints_user_id_fkey;
    ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

    -- 3. Truncate all tables to avoid type conversion errors
    TRUNCATE TABLE public.kyc_submissions CASCADE;
    TRUNCATE TABLE public.bill_submissions CASCADE;
    TRUNCATE TABLE public.payment_submissions CASCADE;
    TRUNCATE TABLE public.complaint_messages CASCADE;
    TRUNCATE TABLE public.complaints CASCADE;
    TRUNCATE TABLE public.notifications CASCADE;
    TRUNCATE TABLE public.users_profiles CASCADE;

    -- 4. Alter column types to TEXT
    ALTER TABLE public.users_profiles ALTER COLUMN id TYPE TEXT;
    ALTER TABLE public.kyc_submissions ALTER COLUMN user_id TYPE TEXT;
    ALTER TABLE public.bill_submissions ALTER COLUMN user_id TYPE TEXT;
    ALTER TABLE public.payment_submissions ALTER COLUMN user_id TYPE TEXT;
    ALTER TABLE public.complaints ALTER COLUMN user_id TYPE TEXT;
    ALTER TABLE public.notifications ALTER COLUMN user_id TYPE TEXT;

    -- Set the default value for users_profiles.id
    ALTER TABLE public.users_profiles ALTER COLUMN id SET DEFAULT generate_user_id();

    -- Re-add Foreign Keys
    ALTER TABLE public.kyc_submissions ADD CONSTRAINT kyc_submissions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users_profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.bill_submissions ADD CONSTRAINT bill_submissions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users_profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.payment_submissions ADD CONSTRAINT payment_submissions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users_profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.complaints ADD CONSTRAINT complaints_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users_profiles(id) ON DELETE CASCADE;
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users_profiles(id) ON DELETE CASCADE;

    -- Recreate Policies with TEXT compatibility (auth.uid()::text)
    CREATE POLICY "bill_submissions_user_access" ON public.bill_submissions
        FOR ALL USING (auth.uid()::text = user_id);

    CREATE POLICY "bill_submissions_admin_access" ON public.bill_submissions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users_profiles
                WHERE id = auth.uid()::text AND role = 'admin'
            )
        );

    CREATE POLICY "payment_submissions_user_access" ON public.payment_submissions
        FOR ALL USING (auth.uid()::text = user_id);

    CREATE POLICY "payment_submissions_admin_access" ON public.payment_submissions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users_profiles
                WHERE id = auth.uid()::text AND role = 'admin'
            )
        );

    CREATE POLICY "kyc_submissions_owner_read" ON public.kyc_submissions 
        FOR SELECT USING (auth.uid()::text = user_id);
    
    CREATE POLICY "kyc_submissions_owner_insert" ON public.kyc_submissions 
        FOR INSERT WITH CHECK (auth.uid()::text = user_id);
    
    CREATE POLICY "kyc_submissions_admin_all" ON public.kyc_submissions 
        FOR ALL USING (true);

END $$;

-- 4. Refresh schema cache
NOTIFY pgrst, 'reload schema';