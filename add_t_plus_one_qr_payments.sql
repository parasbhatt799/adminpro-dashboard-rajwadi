-- ==========================================================
-- ADD T+1 QR PAYMENT SETTLEMENT FIELDS & FUNCTIONS
-- ==========================================================

-- 1. Alter tables to add new fields
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS t_plus_one_charge NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS t_plus_one_balance NUMERIC DEFAULT 0;

ALTER TABLE public.payment_submissions 
ADD COLUMN IF NOT EXISTS t_plus_one BOOLEAN DEFAULT FALSE;

ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS t_plus_one_limit NUMERIC DEFAULT 2000000;

-- 2. Update approve_qr_payment SQL Function
CREATE OR REPLACE FUNCTION public.approve_qr_payment(p_payment_id UUID, p_admin_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_user RECORD;
    v_distributor RECORD;
    v_super_distributor RECORD;
    v_qr_settings RECORD;
    
    v_total_charges NUMERIC;
    v_admin_share NUMERIC;
    v_distributor_profit NUMERIC;
    v_super_distributor_profit NUMERIC;
    
    v_user_percentage NUMERIC;
    v_distributor_base_percentage NUMERIC;
    v_super_distributor_base_percentage NUMERIC;
    v_super_distributor_id TEXT;
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

    -- 3. Calculate charges based on user profile and T+1 flag
    IF v_payment.t_plus_one THEN
        v_user_percentage := COALESCE(v_user.t_plus_one_charge, 0);
    ELSE
        v_user_percentage := COALESCE(v_user.charge_percentage, 0);
    END IF;
    v_total_charges := (v_payment.amount * v_user_percentage) / 100;
    
    v_admin_share := v_total_charges;
    v_distributor_profit := 0;
    v_super_distributor_profit := 0;
    v_super_distributor_id := NULL;

    -- 4. Logic for Multi-level Profit Sharing (ONLY for standard non-T+1 payments)
    IF NOT v_payment.t_plus_one AND v_user.distributor_id IS NOT NULL THEN
        -- Lock the distributor profile
        SELECT * INTO v_distributor 
        FROM public.users_profiles 
        WHERE id = v_user.distributor_id FOR UPDATE;

        IF FOUND THEN
            v_distributor_base_percentage := COALESCE(v_distributor.admin_base_qr_charge, 0);
            
            -- Check if distributor has a super distributor parent
            IF v_distributor.super_distributor_id IS NOT NULL THEN
                -- Lock the super distributor profile
                SELECT * INTO v_super_distributor 
                FROM public.users_profiles 
                WHERE id = v_distributor.super_distributor_id FOR UPDATE;
                
                IF FOUND AND v_super_distributor.role = 'super_distributor' THEN
                    v_super_distributor_id := v_super_distributor.id;
                    v_super_distributor_base_percentage := COALESCE(v_super_distributor.admin_base_qr_charge, 0);
                    
                    -- Splits calculations:
                    -- Admin gets the base charge set on Super Distributor
                    v_admin_share := (v_payment.amount * v_super_distributor_base_percentage) / 100;
                    
                    -- Super Distributor gets the difference between Distributor's base charge and their own base charge
                    v_super_distributor_profit := (v_payment.amount * (v_distributor_base_percentage - v_super_distributor_base_percentage)) / 100;
                    
                    -- Distributor gets the difference between User's charge and their own base charge
                    v_distributor_profit := v_total_charges - ((v_payment.amount * v_distributor_base_percentage) / 100);
                ELSE
                    -- fallback if super distributor not found or incorrect role
                    v_admin_share := (v_payment.amount * v_distributor_base_percentage) / 100;
                    v_distributor_profit := v_total_charges - v_admin_share;
                END IF;
            ELSE
                -- Normal distributor-user path (Admin -> Distributor -> User)
                v_admin_share := (v_payment.amount * v_distributor_base_percentage) / 100;
                v_distributor_profit := v_total_charges - v_admin_share;
            END IF;
        END IF;
    END IF;

    -- Ensure negative commission values aren't created due to incorrect configurations
    v_admin_share := GREATEST(0, v_admin_share);
    v_distributor_profit := GREATEST(0, v_distributor_profit);
    v_super_distributor_profit := GREATEST(0, v_super_distributor_profit);

    -- 5. Lock and update QR settings (Admin Balance)
    SELECT * INTO v_qr_settings FROM public.qr_settings WHERE id = 1 FOR UPDATE;
    UPDATE public.qr_settings 
    SET admin_balance = COALESCE(admin_balance, 0) + v_admin_share 
    WHERE id = 1;

    -- 6. Update User Wallet (wallet_balance if normal, t_plus_one_balance if T+1)
    IF v_payment.t_plus_one THEN
        UPDATE public.users_profiles 
        SET t_plus_one_balance = COALESCE(t_plus_one_balance, 0) + (v_payment.amount - v_total_charges) 
        WHERE id = v_payment.user_id;
    ELSE
        UPDATE public.users_profiles 
        SET wallet_balance = COALESCE(wallet_balance, 0) + (v_payment.amount - v_total_charges) 
        WHERE id = v_payment.user_id;
    END IF;

    -- 7. Update Distributor Wallet if applicable (Commission Wallet) - Only if NOT T+1
    IF NOT v_payment.t_plus_one AND v_distributor_profit > 0 AND v_user.distributor_id IS NOT NULL THEN
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

    -- 7b. Update Super Distributor Wallet if applicable (Commission Wallet) - Only if NOT T+1
    IF NOT v_payment.t_plus_one AND v_super_distributor_profit > 0 AND v_super_distributor_id IS NOT NULL THEN
        UPDATE public.users_profiles 
        SET commission_balance = COALESCE(commission_balance, 0) + v_super_distributor_profit 
        WHERE id = v_super_distributor_id;

        -- Notify Super Distributor
        INSERT INTO public.notifications (user_id, target_role, title, message, link)
        VALUES (
            v_super_distributor_id, 
            'user', 
            'Super Profit Earned!', 
            'You earned ₹' || ROUND(v_super_distributor_profit, 2)::TEXT || ' super profit from a sub-distributor''s QR payment.', 
            '/user/statement'
        );
    END IF;

    -- 8. Update Payment Submission status and store calculated shares
    UPDATE public.payment_submissions 
    SET 
        status = CASE WHEN v_payment.t_plus_one THEN 'T+1 Approved' ELSE 'approved' END,
        charges = v_total_charges,
        admin_share = v_admin_share,
        distributor_share = v_distributor_profit,
        super_distributor_share = v_super_distributor_profit,
        super_distributor_id = v_super_distributor_id,
        actioned_by = p_admin_id,
        actioned_at = NOW()
    WHERE id = p_payment_id;

    -- 9. Notify User
    INSERT INTO public.notifications (user_id, target_role, title, message, link)
    VALUES (
        v_payment.user_id, 
        'user', 
        CASE WHEN v_payment.t_plus_one THEN 'QR Payment T+1 Approved' ELSE 'QR Payment Approved' END, 
        CASE WHEN v_payment.t_plus_one THEN 'Your QR payment of ₹' || v_payment.amount::TEXT || ' has been approved for T+1 settlement! Balance will credit tomorrow at 11:30 AM.' ELSE 'Your QR payment of ₹' || v_payment.amount::TEXT || ' has been approved!' END, 
        '/user/payment'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', CASE WHEN v_payment.t_plus_one THEN 'Payment approved for T+1 settlement successfully' ELSE 'Payment approved successfully' END,
        'data', jsonb_build_object(
            'amount', v_payment.amount,
            'credited_amount', v_payment.amount - v_total_charges,
            'total_charges', v_total_charges,
            'admin_share', v_admin_share,
            'distributor_share', v_distributor_profit,
            'super_distributor_share', v_super_distributor_profit,
            'user_id', v_payment.user_id,
            't_plus_one', v_payment.t_plus_one
        )
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transaction failed: ' || SQLERRM);
END;
$$;


-- 3. Update revert_qr_payment_status SQL Function
DROP FUNCTION IF EXISTS public.revert_qr_payment_status(UUID, TEXT, TEXT);
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

    -- 2. Handle Reversal of 'approved' or 'T+1 Approved' status
    IF v_payment.status = 'approved' OR v_payment.status = 'T+1 Approved' THEN
        -- Reverse Admin Balance
        UPDATE public.qr_settings 
        SET admin_balance = COALESCE(admin_balance, 0) - COALESCE(v_payment.admin_share, 0)
        WHERE id = 1;

        -- Reverse User Wallet (Deduct: Amount - Charges) from appropriate balance
        IF v_payment.status = 'T+1 Approved' THEN
            UPDATE public.users_profiles 
            SET t_plus_one_balance = COALESCE(t_plus_one_balance, 0) - (v_payment.amount - COALESCE(v_payment.charges, 0)) 
            WHERE id = v_payment.user_id;
        ELSIF v_payment.status = 'approved' THEN
            UPDATE public.users_profiles 
            SET wallet_balance = COALESCE(wallet_balance, 0) - (v_payment.amount - COALESCE(v_payment.charges, 0)) 
            WHERE id = v_payment.user_id;
        END IF;

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

        -- Reverse Super Distributor Wallet if applicable
        IF COALESCE(v_payment.super_distributor_share, 0) > 0 AND v_payment.super_distributor_id IS NOT NULL THEN
            UPDATE public.users_profiles 
            SET commission_balance = COALESCE(commission_balance, 0) - v_payment.super_distributor_share 
            WHERE id = v_payment.super_distributor_id;
        END IF;

        -- Notify user about reversal
        INSERT INTO public.notifications (user_id, target_role, title, message, link)
        VALUES (
            v_payment.user_id, 
            'user', 
            'QR Payment Reversed', 
            'Your QR payment of ₹' || v_payment.amount::TEXT || ' has been changed from ' || v_payment.status || ' to ' || p_new_status || '.',
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
        distributor_share = CASE WHEN p_new_status = 'pending' THEN NULL ELSE distributor_share END,
        super_distributor_share = CASE WHEN p_new_status = 'pending' THEN NULL ELSE super_distributor_share END,
        super_distributor_id = CASE WHEN p_new_status = 'pending' THEN NULL ELSE super_distributor_id END
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', true, 'message', 'Status updated to ' || p_new_status);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Operation failed: ' || SQLERRM);
END;
$$;


-- 4. Create settle_t_plus_one_payments SQL Function
CREATE OR REPLACE FUNCTION public.settle_t_plus_one_payments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_count INTEGER := 0;
    v_settled_amount NUMERIC := 0;
    v_today_ist DATE;
BEGIN
    -- Get today's date in IST (Kolkata timezone)
    v_today_ist := (timezone('Asia/Kolkata', now()))::date;

    -- Lock and process each T+1 Approved request approved before today
    FOR r IN 
        SELECT * FROM public.payment_submissions 
        WHERE status = 'T+1 Approved' 
          AND (actioned_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date < v_today_ist
        FOR UPDATE
    LOOP
        -- Credit User Wallet (Credit Amount - Total Charges) and deduct from T+1 Wallet
        UPDATE public.users_profiles 
        SET 
            wallet_balance = COALESCE(wallet_balance, 0) + (r.amount - COALESCE(r.charges, 0)),
            t_plus_one_balance = GREATEST(0, COALESCE(t_plus_one_balance, 0) - (r.amount - COALESCE(r.charges, 0)))
        WHERE id = r.user_id;

        -- Update payment status to approved
        UPDATE public.payment_submissions 
        SET status = 'approved' 
        WHERE id = r.id;

        -- Notify User
        INSERT INTO public.notifications (user_id, target_role, title, message, link)
        VALUES (
            r.user_id, 
            'user', 
            'T+1 Balance Settled', 
            'Your T+1 QR payment of ₹' || r.amount::TEXT || ' (credited ₹' || (r.amount - COALESCE(r.charges, 0))::TEXT || ') has been settled and added to your wallet.', 
            '/user/payment'
        );

        v_count := v_count + 1;
        v_settled_amount := v_settled_amount + (r.amount - COALESCE(r.charges, 0));
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Settled ' || v_count::TEXT || ' payments',
        'count', v_count,
        'settled_amount', v_settled_amount
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Settlement failed: ' || SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
