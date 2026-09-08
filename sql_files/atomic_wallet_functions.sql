-- ATOMIC WALLET FUNCTIONS
-- Run this in your Supabase SQL Editor

-- 1. Atomic Bill Payment Function
CREATE OR REPLACE FUNCTION submit_bill_payment_atomic(
    p_user_id TEXT,
    p_customer_mobile TEXT,
    p_card_bank TEXT,
    p_card_number TEXT,
    p_card_owner_name TEXT,
    p_amount NUMERIC,
    p_charges NUMERIC
) RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_total_deduction NUMERIC;
    v_new_balance NUMERIC;
    v_bill_id UUID;
BEGIN
    -- Calculate total deduction
    v_total_deduction := p_amount + p_charges;

    -- Lock the user's row for update to prevent race conditions
    SELECT wallet_balance INTO v_current_balance
    FROM public.users_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Check if balance is sufficient (min 250 balance rule)
    IF (v_current_balance - v_total_deduction) < 250 THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. Must maintain at least ₹250.');
    END IF;

    -- Calculate new balance
    v_new_balance := v_current_balance - v_total_deduction;

    -- Update wallet
    UPDATE public.users_profiles
    SET wallet_balance = v_new_balance
    WHERE id = p_user_id;

    -- Insert bill submission
    INSERT INTO public.bill_submissions (
        user_id, customer_mobile, card_bank, card_number, card_owner_name, 
        amount, charges, status, remaining_balance
    ) VALUES (
        p_user_id, p_customer_mobile, p_card_bank, p_card_number, p_card_owner_name, 
        p_amount, p_charges, 'pending', v_new_balance
    ) RETURNING id INTO v_bill_id;

    -- Return success
    RETURN json_build_object(
        'success', true, 
        'bill_id', v_bill_id, 
        'new_balance', v_new_balance,
        'message', 'Bill payment submitted successfully!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Atomic Payout Request Function
CREATE OR REPLACE FUNCTION submit_payout_request_atomic(
    p_user_id TEXT,
    p_bank_name TEXT,
    p_holder_name TEXT,
    p_account_number TEXT,
    p_ifsc_code TEXT,
    p_amount NUMERIC,
    p_charges NUMERIC
) RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_total_deduction NUMERIC;
    v_new_balance NUMERIC;
    v_payout_id UUID;
BEGIN
    -- Calculate total deduction
    v_total_deduction := p_amount + p_charges;

    -- Lock the user's row for update to prevent race conditions
    SELECT wallet_balance INTO v_current_balance
    FROM public.users_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Check if balance is sufficient (min 250 balance rule)
    IF (v_current_balance - v_total_deduction) < 250 THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. Must maintain at least ₹250.');
    END IF;

    -- Calculate new balance
    v_new_balance := v_current_balance - v_total_deduction;

    -- Update wallet
    UPDATE public.users_profiles
    SET wallet_balance = v_new_balance
    WHERE id = p_user_id;

    -- Insert payout submission
    INSERT INTO public.payout_submissions (
        user_id, bank_name, account_holder_name, account_number, ifsc_code, 
        amount, charges, status, remaining_balance
    ) VALUES (
        p_user_id, p_bank_name, p_holder_name, p_account_number, p_ifsc_code, 
        p_amount, p_charges, 'pending', v_new_balance
    ) RETURNING id INTO v_payout_id;

    -- Return success
    RETURN json_build_object(
        'success', true, 
        'payout_id', v_payout_id, 
        'new_balance', v_new_balance,
        'message', 'Payout request submitted successfully!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Atomic Bill Rejection (Refund)
CREATE OR REPLACE FUNCTION reject_bill_payment_atomic(
    p_bill_id UUID,
    p_reason TEXT
) RETURNS JSON AS $$
DECLARE
    v_user_id TEXT;
    v_amount NUMERIC;
    v_charges NUMERIC;
    v_total_refund NUMERIC;
    v_current_balance NUMERIC;
BEGIN
    -- 1. Get details and lock row
    SELECT user_id, amount, charges INTO v_user_id, v_amount, v_charges
    FROM public.bill_submissions
    WHERE id = p_bill_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Pending bill request not found');
    END IF;

    -- 2. Lock user profile
    SELECT wallet_balance INTO v_current_balance
    FROM public.users_profiles
    WHERE id = v_user_id
    FOR UPDATE;

    -- 3. Calculate refund
    v_total_refund := v_amount + v_charges;

    -- 4. Update status
    UPDATE public.bill_submissions
    SET status = 'rejected', rejection_reason = p_reason
    WHERE id = p_bill_id;

    -- 5. Update wallet
    UPDATE public.users_profiles
    SET wallet_balance = v_current_balance + v_total_refund
    WHERE id = v_user_id;

    RETURN json_build_object('success', true, 'message', 'Bill rejected and funds refunded');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Atomic Bill Approval (Profit Credit)
DROP FUNCTION IF EXISTS approve_bill_payment_atomic(UUID);

CREATE OR REPLACE FUNCTION approve_bill_payment_atomic(
    p_bill_id UUID,
    p_admin_id TEXT
) RETURNS JSON AS $$
DECLARE
    v_charges NUMERIC;
    v_admin_balance NUMERIC;
BEGIN
    -- 1. Get charges and lock
    SELECT charges INTO v_charges
    FROM public.bill_submissions
    WHERE id = p_bill_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Pending bill request not found');
    END IF;

    -- 2. Lock admin balance (id=1)
    SELECT admin_balance INTO v_admin_balance
    FROM public.qr_settings
    WHERE id = 1
    FOR UPDATE;

    -- 3. Update status and shares
    UPDATE public.bill_submissions
    SET 
        status = 'approved', 
        admin_share = v_charges, 
        distributor_share = 0,
        actioned_by = p_admin_id,
        actioned_at = NOW()
    WHERE id = p_bill_id;

    -- 4. Update admin balance
    UPDATE public.qr_settings
    SET admin_balance = v_admin_balance + v_charges
    WHERE id = 1;

    RETURN json_build_object('success', true, 'message', 'Bill approved and profit credited to admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Atomic Payout Rejection (Refund)
CREATE OR REPLACE FUNCTION reject_payout_request_atomic(
    p_payout_id UUID,
    p_reason TEXT
) RETURNS JSON AS $$
DECLARE
    v_user_id TEXT;
    v_amount NUMERIC;
    v_charges NUMERIC;
    v_total_refund NUMERIC;
    v_current_balance NUMERIC;
BEGIN
    -- 1. Get details and lock
    SELECT user_id, amount, charges INTO v_user_id, v_amount, v_charges
    FROM public.payout_submissions
    WHERE id = p_payout_id AND (status = 'pending' OR status = 'processing')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Pending payout request not found');
    END IF;

    -- 2. Lock user profile
    SELECT wallet_balance INTO v_current_balance
    FROM public.users_profiles
    WHERE id = v_user_id
    FOR UPDATE;

    -- 3. Calculate refund
    v_total_refund := v_amount + v_charges;

    -- 4. Update status
    UPDATE public.payout_submissions
    SET status = 'rejected', remark = p_reason
    WHERE id = p_payout_id;

    -- 5. Update wallet
    UPDATE public.users_profiles
    SET wallet_balance = v_current_balance + v_total_refund
    WHERE id = v_user_id;

    RETURN json_build_object('success', true, 'message', 'Payout rejected and funds refunded');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Atomic Adjust Hold Balance
CREATE OR REPLACE FUNCTION adjust_user_hold_balance_atomic(
    p_user_id TEXT,
    p_target_hold NUMERIC
) RETURNS JSON AS $$
DECLARE
    v_current_wallet NUMERIC;
    v_current_hold NUMERIC;
    v_diff NUMERIC;
    v_new_wallet NUMERIC;
    v_user_uuid UUID;
BEGIN
    -- 0. Validate input
    IF p_target_hold < 0 THEN
        RETURN json_build_object('success', false, 'message', 'Hold balance cannot be negative');
    END IF;

    -- 1. Try to cast ID to UUID if possible, otherwise use as text
    -- This handles cases where ID column might be UUID
    BEGIN
        v_user_uuid := p_user_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_uuid := NULL;
    END;

    -- 2. Lock user profile (trying both text and uuid match)
    SELECT wallet_balance, hold_balance INTO v_current_wallet, v_current_hold
    FROM public.users_profiles
    WHERE id = p_user_id OR (v_user_uuid IS NOT NULL AND id::text = v_user_uuid::text)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- 3. Calculate difference
    v_diff := p_target_hold - v_current_hold;

    IF v_diff = 0 THEN
        RETURN json_build_object('success', true, 'new_wallet', v_current_wallet, 'new_hold', v_current_hold, 'message', 'No change needed');
    END IF;

    IF v_diff > 0 THEN
        -- Holding more funds: Check if wallet has enough
        IF v_current_wallet < v_diff THEN
            RETURN json_build_object('success', false, 'message', 'Insufficient wallet balance (Required: ' || v_diff || ', Available: ' || v_current_wallet || ')');
        END IF;
        v_new_wallet := v_current_wallet - v_diff;
    ELSE
        -- Releasing funds: Move from hold to wallet
        v_new_wallet := v_current_wallet + ABS(v_diff);
    END IF;

    -- 4. Update profile
    UPDATE public.users_profiles
    SET wallet_balance = v_new_wallet, hold_balance = p_target_hold
    WHERE id = p_user_id OR (v_user_uuid IS NOT NULL AND id::text = v_user_uuid::text);

    RETURN json_build_object(
        'success', true, 
        'new_wallet', v_new_wallet, 
        'new_hold', p_target_hold,
        'message', 'Hold balance adjusted successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
