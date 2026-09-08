-- Setup script for bill_submissions and payment_submissions tables

-- 0. Ensure role column exists in users_profiles
ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 1. Create bill_submissions table
CREATE TABLE IF NOT EXISTS public.bill_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    customer_mobile TEXT NOT NULL,
    card_bank TEXT NOT NULL,
    card_number TEXT NOT NULL,
    card_owner_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    charges NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    remaining_balance NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create payment_submissions table (QR Payments)
CREATE TABLE IF NOT EXISTS public.payment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    utr_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    proof_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    charges NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.bill_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for bill_submissions
DO $$ 
BEGIN
    -- Drop existing policies if they exist to avoid errors during recreation
    DROP POLICY IF EXISTS "bill_submissions_user_access" ON public.bill_submissions;
    DROP POLICY IF EXISTS "bill_submissions_admin_access" ON public.bill_submissions;

    CREATE POLICY "bill_submissions_user_access" ON public.bill_submissions
        FOR ALL USING (auth.uid() = user_id);

    CREATE POLICY "bill_submissions_admin_access" ON public.bill_submissions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users_profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
        );
END $$;

-- 5. Create Policies for payment_submissions
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "payment_submissions_user_access" ON public.payment_submissions;
    DROP POLICY IF EXISTS "payment_submissions_admin_access" ON public.payment_submissions;

    CREATE POLICY "payment_submissions_user_access" ON public.payment_submissions
        FOR ALL USING (auth.uid() = user_id);

    CREATE POLICY "payment_submissions_admin_access" ON public.payment_submissions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users_profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
        );
END $$;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
