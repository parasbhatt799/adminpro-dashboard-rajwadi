-- Update payout_submissions to track Camlenio specific fields
ALTER TABLE public.payout_submissions 
ADD COLUMN IF NOT EXISTS txn_id TEXT,
ADD COLUMN IF NOT EXISTS bank_ref TEXT;

-- Create an updated RPC for automatic payout submissions
CREATE OR REPLACE FUNCTION submit_auto_payout_request(
    p_user_id UUID,
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
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. Must maintain 250 in wallet.');
    END IF;

    -- 2. Deduct wallet
    UPDATE public.users_profiles
    SET wallet_balance = wallet_balance - v_total_deduction
    WHERE id = p_user_id;

    -- 3. Create payout record
    INSERT INTO public.payout_submissions (
        user_id, bank_name, beneficiary_name, account_number, ifsc_code,
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
