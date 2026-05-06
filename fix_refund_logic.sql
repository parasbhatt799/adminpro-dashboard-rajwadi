-- 1. Move to Refund Policy (No funds moved)
CREATE OR REPLACE FUNCTION refund_bill_payment_atomic(
    p_bill_id UUID
) RETURNS JSON AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status
    FROM public.bill_submissions
    WHERE id = p_bill_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Bill request not found');
    END IF;

    IF v_status = 'refunded' THEN
        RETURN json_build_object('success', false, 'message', 'Already in Refund Policy review');
    END IF;

    UPDATE public.bill_submissions
    SET status = 'refunded'
    WHERE id = p_bill_id;

    RETURN json_build_object('success', true, 'message', 'Moved to Refund Policy. Funds remain deducted.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Confirm Refund from Refund Policy (Return funds to user, deduct from admin)
CREATE OR REPLACE FUNCTION confirm_bill_refund_atomic(
    p_bill_id UUID,
    p_reason TEXT
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

    IF v_status != 'refunded' THEN
        RETURN json_build_object('success', false, 'message', 'Only requests in Refund Policy can be confirmed for refund here');
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

    -- 4. Update status to rejected
    UPDATE public.bill_submissions
    SET status = 'rejected', rejection_reason = p_reason
    WHERE id = p_bill_id;

    -- 5. Refund user's wallet
    UPDATE public.users_profiles
    SET wallet_balance = v_current_user_balance + v_total_refund
    WHERE id = v_user_id;

    -- 6. Deduct the profit from admin balance (since it was previously credited)
    UPDATE public.qr_settings
    SET admin_balance = GREATEST(0, v_current_admin_balance - v_charges)
    WHERE id = 1;

    RETURN json_build_object('success', true, 'message', 'Bill rejected and funds refunded to user wallet');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Re-Approve from Refund Policy (Just change status back)
CREATE OR REPLACE FUNCTION reapprove_bill_payment_atomic(
    p_bill_id UUID
) RETURNS JSON AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status
    FROM public.bill_submissions
    WHERE id = p_bill_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Bill request not found');
    END IF;

    IF v_status != 'refunded' THEN
        RETURN json_build_object('success', false, 'message', 'Only requests in Refund Policy can be re-approved here');
    END IF;

    UPDATE public.bill_submissions
    SET status = 'approved'
    WHERE id = p_bill_id;

    RETURN json_build_object('success', true, 'message', 'Bill re-approved successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
