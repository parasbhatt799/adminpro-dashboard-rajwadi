-- ==========================================================
-- ADD SUPER DISTRIBUTOR SCHEMA & OVERRIDE FUNCTIONS
-- Run this script in your Supabase SQL Editor to sync changes.
-- ==========================================================

-- 1. Alter users_profiles to add super_distributor_id
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS super_distributor_id TEXT REFERENCES public.users_profiles(id) ON DELETE SET NULL;

-- 2. Alter payment_submissions to add super_distributor_id and super_distributor_share
ALTER TABLE public.payment_submissions 
ADD COLUMN IF NOT EXISTS super_distributor_id TEXT REFERENCES public.users_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS super_distributor_share NUMERIC DEFAULT 0;

-- 3. Alter bill_submissions to add super_distributor_id and super_distributor_share
ALTER TABLE public.bill_submissions 
ADD COLUMN IF NOT EXISTS super_distributor_id TEXT REFERENCES public.users_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS super_distributor_share NUMERIC DEFAULT 0;

-- 4. Override approve_qr_payment function
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

    -- 3. Calculate charges based on user profile
    v_user_percentage := COALESCE(v_user.charge_percentage, 0);
    v_total_charges := (v_payment.amount * v_user_percentage) / 100;
    
    v_admin_share := v_total_charges;
    v_distributor_profit := 0;
    v_super_distributor_profit := 0;
    v_super_distributor_id := NULL;

    -- 4. Logic for Multi-level Profit Sharing (Admin -> Super Distributor -> Distributor -> User)
    IF v_user.distributor_id IS NOT NULL THEN
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

    -- 7b. Update Super Distributor Wallet if applicable (Commission Wallet)
    IF v_super_distributor_profit > 0 AND v_super_distributor_id IS NOT NULL THEN
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
        status = 'approved',
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
            'super_distributor_share', v_super_distributor_profit,
            'user_id', v_payment.user_id
        )
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transaction failed: ' || SQLERRM);
END;
$$;


-- 5. Override revert_qr_payment_status function
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
        distributor_share = CASE WHEN p_new_status = 'pending' THEN NULL ELSE distributor_share END,
        super_distributor_share = CASE WHEN p_new_status = 'pending' THEN NULL ELSE super_distributor_share END,
        super_distributor_id = CASE WHEN p_new_status = 'pending' THEN NULL ELSE super_distributor_id END
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', true, 'message', 'Status updated to ' || p_new_status);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Operation failed: ' || SQLERRM);
END;
$$;


-- 6. Override/Create get_dashboard_stats function
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_start_date TEXT, p_end_date TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    
    v_admin_wallet_balance NUMERIC;
    v_total_user_wallet_balance NUMERIC;
    v_active_users_count BIGINT;
    
    v_pending_kyc_count BIGINT;
    v_pending_bill_count BIGINT;
    v_pending_qr_count BIGINT;
    v_pending_payout_count BIGINT;
    
    v_range_qr_amount NUMERIC;
    v_range_bill_amount NUMERIC;
    v_range_payout_amount NUMERIC;
    
    v_admin_qr_charges NUMERIC;
    v_admin_bill_charges NUMERIC;
    v_range_payout_charges NUMERIC;
    
    v_range_withdrawals NUMERIC;
    v_total_distributor_share NUMERIC;
    v_total_distributor_share_bill NUMERIC;
    v_total_super_distributor_share NUMERIC;
BEGIN
    -- Parse dates
    IF p_start_date IS NOT NULL AND p_start_date <> '' THEN
        v_start := p_start_date::TIMESTAMPTZ;
    ELSE
        v_start := '-infinity'::TIMESTAMPTZ;
    END IF;

    IF p_end_date IS NOT NULL AND p_end_date <> '' THEN
        v_end := p_end_date::TIMESTAMPTZ;
    ELSE
        v_end := 'infinity'::TIMESTAMPTZ;
    END IF;

    -- Lifetime/Global aggregates
    SELECT COALESCE(admin_balance, 0) INTO v_admin_wallet_balance FROM public.qr_settings WHERE id = 1;
    SELECT COALESCE(SUM(wallet_balance), 0) INTO v_total_user_wallet_balance FROM public.users_profiles WHERE role = 'user';
    SELECT COUNT(*) INTO v_active_users_count FROM public.users_profiles WHERE status = 'Active' AND role = 'user';
    
    -- Pending counts
    SELECT COUNT(*) INTO v_pending_kyc_count FROM public.kyc_submissions WHERE status = 'pending';
    SELECT COUNT(*) INTO v_pending_bill_count FROM public.bill_submissions WHERE status = 'pending';
    SELECT COUNT(*) INTO v_pending_qr_count FROM public.payment_submissions WHERE status = 'pending';
    SELECT COUNT(*) INTO v_pending_payout_count FROM public.payout_submissions WHERE status = 'pending';

    -- Range aggregates for QR Payments
    SELECT 
        COALESCE(SUM(amount), 0), 
        COALESCE(SUM(admin_share), 0), 
        COALESCE(SUM(distributor_share), 0),
        COALESCE(SUM(super_distributor_share), 0)
    INTO 
        v_range_qr_amount, 
        v_admin_qr_charges, 
        v_total_distributor_share,
        v_total_super_distributor_share
    FROM public.payment_submissions
    WHERE status = 'approved' AND created_at >= v_start AND created_at <= v_end;

    -- Range aggregates for Credit Card Bill Payments
    SELECT 
        COALESCE(SUM(amount), 0), 
        COALESCE(SUM(admin_share), 0), 
        COALESCE(SUM(distributor_share), 0)
    INTO 
        v_range_bill_amount, 
        v_admin_bill_charges, 
        v_total_distributor_share_bill
    FROM public.bill_submissions
    WHERE status = 'approved' AND created_at >= v_start AND created_at <= v_end;

    v_total_distributor_share := v_total_distributor_share + COALESCE(v_total_distributor_share_bill, 0);

    -- Range aggregates for Payouts
    SELECT 
        COALESCE(SUM(amount), 0), 
        COALESCE(SUM(charge_amount), 0)
    INTO 
        v_range_payout_amount, 
        v_range_payout_charges
    FROM public.payout_submissions
    WHERE status = 'approved' AND created_at >= v_start AND created_at <= v_end;

    -- Range aggregates for Admin Withdrawals
    SELECT COALESCE(SUM(amount), 0) INTO v_range_withdrawals
    FROM public.admin_withdrawals
    WHERE created_at >= v_start AND created_at <= v_end;

    RETURN jsonb_build_object(
        'admin_wallet_balance', v_admin_wallet_balance,
        'total_user_wallet_balance', v_total_user_wallet_balance,
        'active_users_count', v_active_users_count,
        'pending_kyc_count', v_pending_kyc_count,
        'pending_bill_count', v_pending_bill_count,
        'pending_qr_count', v_pending_qr_count,
        'pending_payout_count', v_pending_payout_count,
        'range_qr_amount', v_range_qr_amount,
        'range_bill_amount', v_range_bill_amount,
        'range_payout_amount', v_range_payout_amount,
        'admin_qr_charges', v_admin_qr_charges,
        'admin_bill_charges', v_admin_bill_charges,
        'range_payout_charges', v_range_payout_charges,
        'range_withdrawals', v_range_withdrawals,
        'total_distributor_share', v_total_distributor_share,
        'total_super_distributor_share', v_total_super_distributor_share
    );
END;
$$;

-- 7. Notify Schema Cache Reload
NOTIFY pgrst, 'reload schema';
