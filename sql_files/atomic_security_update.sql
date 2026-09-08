-- ATOMIC SECURITY UPDATE: PAYOUT APPROVAL & BILL REFUND
-- Run this in your Supabase SQL Editor

-- 1. Atomic Payout Approval Function
CREATE OR REPLACE FUNCTION approve_payout_request_atomic(
    p_payout_id UUID,
    p_transaction_id TEXT,
    p_proof_url TEXT
) RETURNS JSON AS $$
DECLARE
    v_charges NUMERIC;
    v_admin_balance NUMERIC;
    v_status TEXT;
BEGIN
    -- 1. Lock and get payout details
    SELECT charge_amount, status INTO v_charges, v_status
    FROM public.payout_submissions
    WHERE id = p_payout_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Payout request not found');
    END IF;

    IF v_status = 'approved' THEN
        RETURN json_build_object('success', false, 'message', 'This payout is already approved');
    END IF;

    IF v_status = 'rejected' THEN
        RETURN json_build_object('success', false, 'message', 'Cannot approve a rejected payout');
    END IF;

    -- 2. Lock admin balance
    SELECT admin_balance INTO v_admin_balance
    FROM public.qr_settings
    WHERE id = 1
    FOR UPDATE;

    -- 3. Update payout status
    UPDATE public.payout_submissions
    SET status = 'approved', 
        transaction_id = p_transaction_id, 
        proof_url = p_proof_url
    WHERE id = p_payout_id;

    -- 4. Credit service charge to admin
    UPDATE public.qr_settings
    SET admin_balance = v_admin_balance + v_charges
    WHERE id = 1;

    RETURN json_build_object('success', true, 'message', 'Payout approved and profit credited to admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Atomic Bill Refund Function
CREATE OR REPLACE FUNCTION refund_bill_payment_atomic(
    p_bill_id UUID
) RETURNS JSON AS $$
DECLARE
    v_user_id TEXT;
    v_amount NUMERIC;
    v_charges NUMERIC;
    v_total_refund NUMERIC;
    v_current_user_balance NUMERIC;
    v_current_admin_balance NUMERIC;
    v_status TEXT;
BEGIN
    -- 1. Lock and get bill details
    SELECT user_id, amount, charges, status INTO v_user_id, v_amount, v_charges, v_status
    FROM public.bill_submissions
    WHERE id = p_bill_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Bill request not found');
    END IF;

    IF v_status = 'refunded' THEN
        RETURN json_build_object('success', false, 'message', 'This bill is already refunded');
    END IF;

    IF v_status = 'rejected' THEN
        RETURN json_build_object('success', false, 'message', 'Rejected bills are already refunded to wallet');
    END IF;

    -- 2. Calculate total refund amount
    v_total_refund := v_amount + v_charges;

    -- 3. Lock user profile and admin balance
    SELECT wallet_balance INTO v_current_user_balance
    FROM public.users_profiles
    WHERE id = v_user_id
    FOR UPDATE;

    SELECT admin_balance INTO v_current_admin_balance
    FROM public.qr_settings
    WHERE id = 1
    FOR UPDATE;

    -- 4. Update status to refunded
    UPDATE public.bill_submissions
    SET status = 'refunded'
    WHERE id = p_bill_id;

    -- 5. Refund user's wallet
    UPDATE public.users_profiles
    SET wallet_balance = v_current_user_balance + v_total_refund
    WHERE id = v_user_id;

    -- 6. If it was already approved, deduct the profit from admin balance
    IF v_status = 'approved' THEN
        UPDATE public.qr_settings
        SET admin_balance = GREATEST(0, v_current_admin_balance - v_charges)
        WHERE id = 1;
    END IF;

    RETURN json_build_object('success', true, 'message', 'Bill refunded successfully and funds returned to user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
