-- ==========================================
-- RPC: APPROVE QR PAYMENT (ATOMIC TRANSACTION)
-- This function ensures that status updates and wallet increments
-- happen together or not at all, preventing balance glitches.
-- ==========================================

CREATE OR REPLACE FUNCTION public.approve_qr_payment(p_payment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_user RECORD;
    v_distributor RECORD;
    v_qr_settings RECORD;
    v_total_charges NUMERIC;
    v_admin_share NUMERIC;
    v_distributor_profit NUMERIC;
    v_user_percentage NUMERIC;
    v_admin_base_percentage NUMERIC;
BEGIN
    -- 1. Lock the payment request and check status
    SELECT * INTO v_payment 
    FROM public.payment_submissions 
    WHERE id = p_payment_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Payment request not found');
    END IF;

    IF v_payment.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'This request has already been processed (' || v_payment.status || ')');
    END IF;

    -- 2. Lock the user profile
    SELECT * INTO v_user 
    FROM public.users_profiles 
    WHERE id = v_payment.user_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
    END IF;

    -- 3. Calculate charges based on user profile
    v_user_percentage := COALESCE(v_user.charge_percentage, 0);
    v_total_charges := (v_payment.amount * v_user_percentage) / 100;
    
    v_admin_share := v_total_charges;
    v_distributor_profit := 0;

    -- 4. Logic for Distributor Profit Sharing
    IF v_user.distributor_id IS NOT NULL THEN
        -- Lock the distributor profile
        SELECT * INTO v_distributor 
        FROM public.users_profiles 
        WHERE id = v_user.distributor_id FOR UPDATE;

        IF FOUND THEN
            -- Admin's share is based on the Distributor's base charge
            v_admin_base_percentage := COALESCE(v_distributor.admin_base_qr_charge, 0);
            v_admin_share := (v_payment.amount * v_admin_base_percentage) / 100;
            v_distributor_profit := v_total_charges - v_admin_share;
        END IF;
    END IF;

    -- 5. Lock and update QR settings (Admin Balance)
    SELECT * INTO v_qr_settings FROM public.qr_settings WHERE id = 1 FOR UPDATE;
    UPDATE public.qr_settings 
    SET admin_balance = COALESCE(admin_balance, 0) + v_admin_share 
    WHERE id = 1;

    -- 6. Update User Wallet (Credit Amount - Total Charges)
    UPDATE public.users_profiles 
    SET wallet_balance = COALESCE(wallet_balance, 0) + (v_payment.amount - v_total_charges) 
    WHERE id = v_payment.user_id;

    -- 7. Update Distributor Wallet if applicable (Commission Wallet)
    IF v_distributor_profit > 0 AND v_user.distributor_id IS NOT NULL THEN
        UPDATE public.users_profiles 
        SET commission_balance = COALESCE(commission_balance, 0) + v_distributor_profit 
        WHERE id = v_user.distributor_id;

        -- Notify Distributor
        INSERT INTO public.notifications (user_id, target_role, title, message, link)
        VALUES (
            v_user.distributor_id, 
            'user', 
            'Profit Earned!', 
            'You earned ₹' || ROUND(v_distributor_profit, 2)::TEXT || ' profit from a sub-user''s QR payment.', 
            '/user/statement'
        );
    END IF;

    -- 8. Update Payment Submission status and store calculated shares
    UPDATE public.payment_submissions 
    SET 
        status = 'approved',
        charges = v_total_charges,
        admin_share = v_admin_share,
        distributor_share = v_distributor_profit
    WHERE id = p_payment_id;

    -- 9. Notify User
    INSERT INTO public.notifications (user_id, target_role, title, message, link)
    VALUES (
        v_payment.user_id, 
        'user', 
        'QR Payment Approved', 
        'Your QR payment of ₹' || v_payment.amount::TEXT || ' has been approved!', 
        '/user/payment'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Payment approved successfully',
        'data', jsonb_build_object(
            'amount', v_payment.amount,
            'credited_amount', v_payment.amount - v_total_charges,
            'total_charges', v_total_charges,
            'admin_share', v_admin_share,
            'distributor_share', v_distributor_profit,
            'user_id', v_payment.user_id
        )
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transaction failed: ' || SQLERRM);
END;
$$;
