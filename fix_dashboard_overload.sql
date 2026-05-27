-- =========================================================================
-- SQL SCRIPT TO FIX ADMIN DASHBOARD OVERLOAD ERROR
-- Run this in your Supabase SQL Editor to resolve the candidate function error.
-- =========================================================================

-- 1. Drop the old overloaded function with TIMESTAMPTZ arguments
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ);

-- 2. Drop the text version as well to ensure a clean slate
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TEXT);

-- 3. Re-create the correct function with TEXT arguments
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

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
