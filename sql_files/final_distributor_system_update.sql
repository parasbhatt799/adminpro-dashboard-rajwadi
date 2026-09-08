-- ==========================================================
-- FINAL DISTRIBUTOR SYSTEM UPDATE (FIXED TYPE MISMATCH)
-- Run this script in your Supabase SQL Editor to sync all changes.
-- ==========================================================

-- 1. ENHANCE USER PROFILES FOR DISTRIBUTOR SYSTEM
-- Use TEXT for distributor_id to match users_profiles.id type
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS distributor_id TEXT REFERENCES public.users_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS admin_base_qr_charge NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS admin_base_bill_charge NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS firm_name TEXT;

-- 2. CREATE DISTRIBUTOR WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS public.distributor_withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for withdrawals
ALTER TABLE public.distributor_withdrawals ENABLE ROW LEVEL SECURITY;

-- Policy: Distributors can see their own withdrawals
DROP POLICY IF EXISTS "Distributors can view own withdrawals" ON public.distributor_withdrawals;
CREATE POLICY "Distributors can view own withdrawals" 
ON public.distributor_withdrawals FOR SELECT 
TO authenticated 
USING (distributor_id = (SELECT id FROM public.users_profiles WHERE id = auth.uid()));

-- Policy: Admins can manage all withdrawals
DROP POLICY IF EXISTS "Admins can manage all withdrawals" ON public.distributor_withdrawals;
CREATE POLICY "Admins can manage all withdrawals" 
ON public.distributor_withdrawals FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.admin_profiles WHERE mobile_number = (SELECT mobile_number FROM public.users_profiles WHERE id = auth.uid())));

-- 3. ADD "FROZEN PROFIT" COLUMNS TO SUBMISSIONS
ALTER TABLE public.payment_submissions 
ADD COLUMN IF NOT EXISTS admin_share NUMERIC,
ADD COLUMN IF NOT EXISTS distributor_share NUMERIC;

ALTER TABLE public.bill_submissions 
ADD COLUMN IF NOT EXISTS admin_share NUMERIC,
ADD COLUMN IF NOT EXISTS distributor_share NUMERIC;

-- 4. MIGRATE HISTORICAL DATA
DO $$
BEGIN
    -- Update payment_submissions
    UPDATE public.payment_submissions ps
    SET 
        admin_share = CASE 
            WHEN up.distributor_id IS NOT NULL AND dist.role = 'distributor' THEN (ps.amount * dist.admin_base_qr_charge / 100)
            ELSE ps.charges
        END,
        distributor_share = CASE 
            WHEN up.distributor_id IS NOT NULL AND dist.role = 'distributor' THEN ps.charges - (ps.amount * dist.admin_base_qr_charge / 100)
            ELSE 0
        END
    FROM public.users_profiles up
    LEFT JOIN public.users_profiles dist ON up.distributor_id = dist.id
    WHERE ps.user_id = up.id AND ps.status = 'approved' AND ps.admin_share IS NULL;

    -- Update bill_submissions
    UPDATE public.bill_submissions bs
    SET 
        admin_share = bs.charges,
        distributor_share = 0
    WHERE bs.status = 'approved' AND bs.admin_share IS NULL;
END $$;

-- 5. REAL-TIME REPLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.users_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.distributor_withdrawals;
