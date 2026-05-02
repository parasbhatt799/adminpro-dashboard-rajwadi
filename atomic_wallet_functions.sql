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

    -- Just check if balance is sufficient (min 250 balance rule)
    SELECT wallet_balance INTO v_current_balance
    FROM public.users_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    IF (v_current_balance - v_total_deduction) < 250 THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. Must maintain at least ₹250.');
    END IF;

    -- Insert bill submission without updating wallet yet
    INSERT INTO public.bill_submissions (
        user_id, customer_mobile, card_bank, card_number, card_owner_name, 
        amount, charges, status, remaining_balance
    ) VALUES (
        p_user_id, p_customer_mobile, p_card_bank, p_card_number, p_card_owner_name, 
        p_amount, p_charges, 'pending', v_current_balance -- Store current balance as reference
    ) RETURNING id INTO v_bill_id;

    -- Return success
    RETURN json_build_object(
        'success', true, 
        'bill_id', v_bill_id, 
        'message', 'Bill payment submitted successfully! Waiting for admin approval.'
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
    v_payout_id UUID;
BEGIN
    -- Calculate total deduction
    v_total_deduction := p_amount + p_charges;

    -- Check if balance is sufficient
    SELECT wallet_balance INTO v_current_balance
    FROM public.users_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    IF (v_current_balance - v_total_deduction) < 250 THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. Must maintain at least ₹250.');
    END IF;

    -- Insert payout submission without updating wallet yet
    INSERT INTO public.payout_submissions (
        user_id, bank_name, account_holder_name, account_number, ifsc_code, 
        amount, charges, status, remaining_balance
    ) VALUES (
        p_user_id, p_bank_name, p_holder_name, p_account_number, p_ifsc_code, 
        p_amount, p_charges, 'pending', v_current_balance
    ) RETURNING id INTO v_payout_id;

    -- Return success
    RETURN json_build_object(
        'success', true, 
        'payout_id', v_payout_id, 
        'message', 'Payout request submitted successfully! Waiting for admin approval.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
