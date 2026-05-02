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
