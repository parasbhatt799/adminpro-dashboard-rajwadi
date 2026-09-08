-- ==========================================
-- RPC: REVERT QR PAYMENT STATUS
-- This function allows changing status of Approved/Rejected payments
-- and reverses wallet/profit updates if reversing an Approved payment.
-- ==========================================

DROP FUNCTION IF EXISTS public.revert_qr_payment_status(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.revert_qr_payment_status(
    p_payment_id UUID, 
    p_new_status TEXT,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_user RECORD;
    v_distributor_id TEXT;
BEGIN
    -- 1. Lock and check the payment request
    SELECT * INTO v_payment 
    FROM public.payment_submissions 
    WHERE id = p_payment_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Payment request not found');
    END IF;

    -- If already in the target status, do nothing
    IF v_payment.status = p_new_status THEN
        RETURN jsonb_build_object('success', true, 'message', 'Status already set to ' || p_new_status);
    END IF;

    -- 2. Handle Reversal of 'approved' status
    IF v_payment.status = 'approved' THEN
        -- Reverse Admin Balance
        UPDATE public.qr_settings 
        SET admin_balance = COALESCE(admin_balance, 0) - COALESCE(v_payment.admin_share, 0)
        WHERE id = 1;

        -- Reverse User Wallet (Deduct: Amount - Charges)
        UPDATE public.users_profiles 
        SET wallet_balance = COALESCE(wallet_balance, 0) - (v_payment.amount - COALESCE(v_payment.charges, 0)) 
        WHERE id = v_payment.user_id;

        -- Reverse Distributor Wallet if applicable
        IF COALESCE(v_payment.distributor_share, 0) > 0 THEN
            -- Get user's distributor
            SELECT distributor_id INTO v_distributor_id FROM public.users_profiles WHERE id = v_payment.user_id;
            
            IF v_distributor_id IS NOT NULL THEN
                UPDATE public.users_profiles 
                SET commission_balance = COALESCE(commission_balance, 0) - v_payment.distributor_share 
                WHERE id = v_distributor_id;
            END IF;
        END IF;

        -- Notify user about reversal
        INSERT INTO public.notifications (user_id, target_role, title, message, link)
        VALUES (
            v_payment.user_id, 
            'user', 
            'QR Payment Reversed', 
            'Your QR payment of ₹' || v_payment.amount::TEXT || ' has been changed from Approved to ' || p_new_status || '.',
            '/user/payment'
        );
    END IF;

    -- 3. Update the payment record
    UPDATE public.payment_submissions 
    SET 
        status = p_new_status,
        rejection_reason = CASE WHEN p_new_status = 'rejected' THEN p_rejection_reason ELSE (CASE WHEN p_new_status = 'pending' THEN NULL ELSE rejection_reason END) END,
        -- If moving back to pending, clear the shares so they can be recalculated on next approval
        charges = CASE WHEN p_new_status = 'pending' THEN NULL ELSE charges END,
        admin_share = CASE WHEN p_new_status = 'pending' THEN NULL ELSE admin_share END,
        distributor_share = CASE WHEN p_new_status = 'pending' THEN NULL ELSE distributor_share END
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', true, 'message', 'Status updated to ' || p_new_status);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Operation failed: ' || SQLERRM);
END;
$$;
