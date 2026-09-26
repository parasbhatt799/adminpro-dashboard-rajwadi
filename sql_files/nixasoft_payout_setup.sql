-- ============================================================
-- Nixasoft Instant Payout & Dynamic Slabs Setup
-- Run this script in the Supabase SQL Editor if needed
-- ============================================================

-- 1. Ensure payout_submissions has all required tracking columns
ALTER TABLE public.payout_submissions 
ADD COLUMN IF NOT EXISTS txn_id TEXT,
ADD COLUMN IF NOT EXISTS bank_ref TEXT,
ADD COLUMN IF NOT EXISTS utr_number TEXT,
ADD COLUMN IF NOT EXISTS charge_amount NUMERIC DEFAULT 0;

-- 2. Create Payout Slabs Table
CREATE TABLE IF NOT EXISTS public.payout_slabs (
    id TEXT PRIMARY KEY,
    min_amount NUMERIC NOT NULL,
    max_amount NUMERIC NOT NULL,
    charge_type TEXT DEFAULT 'flat',
    charge_value NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default slabs if empty
INSERT INTO public.payout_slabs (id, min_amount, max_amount, charge_type, charge_value, is_active)
VALUES 
    ('slab-1', 100, 50000, 'flat', 25, TRUE),
    ('slab-2', 50001, 100000, 'flat', 50, TRUE),
    ('slab-3', 100001, 200000, 'flat', 75, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.payout_slabs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payout_slabs_all" ON public.payout_slabs;
CREATE POLICY "payout_slabs_all" ON public.payout_slabs FOR ALL USING (true) WITH CHECK (true);

-- 3. Ensure payout_beneficiaries has phone and verified fields
ALTER TABLE public.payout_beneficiaries 
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;

-- Enable RLS
ALTER TABLE public.payout_beneficiaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payout_beneficiaries_all" ON public.payout_beneficiaries;
CREATE POLICY "payout_beneficiaries_all" ON public.payout_beneficiaries FOR ALL USING (true) WITH CHECK (true);

-- 4. Atomic Payout Submission RPC (Debits Wallet & Inserts Record)
CREATE OR REPLACE FUNCTION submit_auto_payout_request(
    p_user_id TEXT,
    p_bank_name TEXT,
    p_holder_name TEXT,
    p_account_number TEXT,
    p_ifsc_code TEXT,
    p_amount NUMERIC,
    p_charges NUMERIC,
    p_txn_id TEXT,
    p_status TEXT,
    p_utr_number TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_balance NUMERIC;
    v_total_deduction NUMERIC;
    v_new_payout_id UUID;
BEGIN
    v_total_deduction := p_amount + p_charges;

    -- 1. Get and lock wallet balance
    SELECT wallet_balance INTO v_wallet_balance
    FROM public.users_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    IF v_wallet_balance - v_total_deduction < 250 THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. Must maintain at least ₹250 in wallet.');
    END IF;

    -- 2. Deduct wallet
    UPDATE public.users_profiles
    SET wallet_balance = wallet_balance - v_total_deduction
    WHERE id = p_user_id;

    -- 3. Create payout record
    INSERT INTO public.payout_submissions (
        user_id, bank_name, account_holder_name, account_number, ifsc_code,
        amount, charge_amount, status, txn_id, utr_number
    ) VALUES (
        p_user_id, p_bank_name, p_holder_name, p_account_number, p_ifsc_code,
        p_amount, p_charges, p_status, p_txn_id, p_utr_number
    ) RETURNING id INTO v_new_payout_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Payout submitted and processed', 
        'new_balance', v_wallet_balance - v_total_deduction,
        'payout_id', v_new_payout_id
    );
END;
$$;
