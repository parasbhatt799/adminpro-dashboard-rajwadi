CREATE OR REPLACE FUNCTION refund_payout_request(
    p_payout_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payout RECORD;
    v_total_refund NUMERIC;
BEGIN
    -- 1. Get and lock the payout record
    SELECT * INTO v_payout
    FROM public.payout_submissions
    WHERE id = p_payout_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Payout not found');
    END IF;

    IF v_payout.status = 'rejected' OR v_payout.status = 'approved' THEN
        RETURN json_build_object('success', false, 'message', 'Payout already processed');
    END IF;

    v_total_refund := COALESCE(v_payout.amount, 0) + COALESCE(v_payout.charge_amount, 0);

    -- 2. Update payout status to rejected
    UPDATE public.payout_submissions
    SET status = 'rejected'
    WHERE id = p_payout_id;

    -- 3. Add balance back to user
    UPDATE public.users_profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_total_refund
    WHERE id = v_payout.user_id;

    RETURN json_build_object('success', true, 'message', 'Refund successful', 'refunded_amount', v_total_refund);
END;
$$;
