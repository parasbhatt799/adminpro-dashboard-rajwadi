-- =========================================================================
-- SQL SCRIPT TO CREATE UNIFIED DASHBOARD RPC FUNCTION
-- Run this in your Supabase SQL Editor to enable super-fast dashboard loading.
-- =========================================================================

DROP FUNCTION IF EXISTS public.get_optimized_dashboard_data(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_optimized_dashboard_data(p_start_date TEXT, p_end_date TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_prev_start TIMESTAMPTZ;
    v_prev_end TIMESTAMPTZ;
    v_diff INTERVAL;

    -- Current stats
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

    -- Prev stats
    v_prev_range_qr_amount NUMERIC;
    v_prev_range_bill_amount NUMERIC;
    v_prev_range_payout_amount NUMERIC;
    v_prev_admin_qr_charges NUMERIC;
    v_prev_admin_bill_charges NUMERIC;
    v_prev_range_payout_charges NUMERIC;
    v_prev_total_distributor_share NUMERIC;
    v_prev_total_distributor_share_bill NUMERIC;
    v_prev_total_super_distributor_share NUMERIC;

    -- BBPS current/prev
    v_bbps_amount NUMERIC;
    v_bbps_charges NUMERIC;
    v_prev_bbps_amount NUMERIC;
    v_prev_bbps_charges NUMERIC;
    v_pending_bbps_count BIGINT;

    -- User registrations current/prev
    v_current_users_reg BIGINT;
    v_prev_users_reg BIGINT;

    -- Sparkline arrays
    v_qr_spark NUMERIC[];
    v_cc_spark NUMERIC[];
    v_bbps_spark NUMERIC[];
    v_user_spark BIGINT[];
    v_qr_charges_spark NUMERIC[];
    v_bill_charges_spark NUMERIC[];
    v_bbps_charges_spark NUMERIC[];
    v_payout_charges_spark NUMERIC[];
    v_dist_share_spark NUMERIC[];
    v_super_dist_share_spark NUMERIC[];
    v_payout_charges_spark_only NUMERIC[];

BEGIN
    -- 1. Parse dates
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

    -- Calculate previous period boundaries
    IF v_start <> '-infinity' AND v_end <> 'infinity' THEN
        v_diff := v_end - v_start;
        v_prev_start := v_start - v_diff - interval '1 second';
        v_prev_end := v_start - interval '1 second';
    ELSE
        v_prev_start := '-infinity'::TIMESTAMPTZ;
        v_prev_end := 'infinity'::TIMESTAMPTZ;
    END IF;

    -- 2. Lifetime aggregates
    SELECT COALESCE(admin_balance, 0) INTO v_admin_wallet_balance FROM public.qr_settings WHERE id = 1;
    SELECT COALESCE(SUM(wallet_balance), 0) INTO v_total_user_wallet_balance FROM public.users_profiles WHERE role = 'user';
    SELECT COUNT(*) INTO v_active_users_count FROM public.users_profiles WHERE status = 'Active' AND role = 'user';

    -- 3. Pending counts
    SELECT COUNT(*) INTO v_pending_kyc_count FROM public.kyc_submissions WHERE status = 'pending';
    SELECT COUNT(*) INTO v_pending_bill_count FROM public.bill_submissions WHERE status = 'pending';
    SELECT COUNT(*) INTO v_pending_qr_count FROM public.payment_submissions WHERE status = 'pending';
    SELECT COUNT(*) INTO v_pending_payout_count FROM public.payout_submissions WHERE status = 'pending';
    SELECT COUNT(*) INTO v_pending_bbps_count FROM public.bbps_submissions WHERE status = 'pending';

    -- 4. Current period aggregates (QR Payments)
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

    -- Current period aggregates (Credit Card Bill Payments)
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

    -- Current period aggregates (Payouts)
    SELECT 
        COALESCE(SUM(amount), 0), 
        COALESCE(SUM(charge_amount), 0)
    INTO 
        v_range_payout_amount, 
        v_range_payout_charges
    FROM public.payout_submissions
    WHERE status = 'approved' AND created_at >= v_start AND created_at <= v_end;

    -- Current period aggregates (Admin Withdrawals)
    SELECT COALESCE(SUM(amount), 0) INTO v_range_withdrawals
    FROM public.admin_withdrawals
    WHERE created_at >= v_start AND created_at <= v_end;

    -- 5. Previous period aggregates (QR Payments)
    SELECT 
        COALESCE(SUM(amount), 0), 
        COALESCE(SUM(admin_share), 0), 
        COALESCE(SUM(distributor_share), 0),
        COALESCE(SUM(super_distributor_share), 0)
    INTO 
        v_prev_range_qr_amount, 
        v_prev_admin_qr_charges, 
        v_prev_total_distributor_share,
        v_prev_total_super_distributor_share
    FROM public.payment_submissions
    WHERE status = 'approved' AND created_at >= v_prev_start AND created_at <= v_prev_end;

    -- Previous period aggregates (Credit Card Bill Payments)
    SELECT 
        COALESCE(SUM(amount), 0), 
        COALESCE(SUM(admin_share), 0), 
        COALESCE(SUM(distributor_share), 0)
    INTO 
        v_prev_range_bill_amount, 
        v_prev_admin_bill_charges, 
        v_prev_total_distributor_share_bill
    FROM public.bill_submissions
    WHERE status = 'approved' AND created_at >= v_prev_start AND created_at <= v_prev_end;

    v_prev_total_distributor_share := v_prev_total_distributor_share + COALESCE(v_prev_total_distributor_share_bill, 0);

    -- Previous period aggregates (Payouts)
    SELECT 
        COALESCE(SUM(amount), 0), 
        COALESCE(SUM(charge_amount), 0)
    INTO 
        v_prev_range_payout_amount, 
        v_prev_range_payout_charges
    FROM public.payout_submissions
    WHERE status = 'approved' AND created_at >= v_prev_start AND created_at <= v_prev_end;

    -- 6. BBPS current/prev range aggregates
    SELECT 
        COALESCE(SUM(amount), 0), 
        COALESCE(SUM(charges), 0)
    INTO 
        v_bbps_amount, 
        v_bbps_charges
    FROM public.bbps_submissions
    WHERE status IN ('approved', 'pending') AND created_at >= v_start AND created_at <= v_end;

    SELECT 
        COALESCE(SUM(amount), 0), 
        COALESCE(SUM(charges), 0)
    INTO 
        v_prev_bbps_amount, 
        v_prev_bbps_charges
    FROM public.bbps_submissions
    WHERE status IN ('approved', 'pending') AND created_at >= v_prev_start AND created_at <= v_prev_end;

    -- 7. User registrations counts
    SELECT COUNT(*) INTO v_current_users_reg
    FROM public.users_profiles
    WHERE role = 'user' AND created_at >= v_start AND created_at <= v_end;

    SELECT COUNT(*) INTO v_prev_users_reg
    FROM public.users_profiles
    WHERE role = 'user' AND created_at >= v_prev_start AND created_at <= v_prev_end;

    -- 8. Sparkline Arrays Calculations (Chronological last 7 days)
    -- QR approved amount sparkline
    SELECT ARRAY(
        SELECT COALESCE(SUM(amount), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.payment_submissions ON status = 'approved' AND created_at >= g.day AND created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_qr_spark;

    -- CC Bill approved amount sparkline
    SELECT ARRAY(
        SELECT COALESCE(SUM(amount), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.bill_submissions ON status = 'approved' AND created_at >= g.day AND created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_cc_spark;

    -- BBPS approved/pending amount sparkline
    SELECT ARRAY(
        SELECT COALESCE(SUM(amount), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.bbps_submissions ON status IN ('approved', 'pending') AND created_at >= g.day AND created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_bbps_spark;

    -- User registration cumulative sparkline
    SELECT ARRAY(
        SELECT v_active_users_count - COUNT(u.id)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.users_profiles u ON u.role = 'user' AND u.created_at >= g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_user_spark;

    -- QR charges approved admin share sparkline
    SELECT ARRAY(
        SELECT COALESCE(SUM(admin_share), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.payment_submissions ON status = 'approved' AND created_at >= g.day AND created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_qr_charges_spark;

    -- CC Bill charges approved admin share sparkline
    SELECT ARRAY(
        SELECT COALESCE(SUM(admin_share), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.bill_submissions ON status = 'approved' AND created_at >= g.day AND created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_bill_charges_spark;

    -- BBPS charges approved/pending sparkline
    SELECT ARRAY(
        SELECT COALESCE(SUM(charges), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.bbps_submissions ON status IN ('approved', 'pending') AND created_at >= g.day AND created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_bbps_charges_spark;

    -- Payout charges approved sparkline
    SELECT ARRAY(
        SELECT COALESCE(SUM(charge_amount), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.payout_submissions ON status = 'approved' AND created_at >= g.day AND created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_payout_charges_spark;

    -- QR + CC distributor share sparkline
    SELECT ARRAY(
        SELECT COALESCE(SUM(ps.distributor_share), 0) + COALESCE(SUM(bs.distributor_share), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.payment_submissions ps ON ps.status = 'approved' AND ps.created_at >= g.day AND ps.created_at < g.day + interval '1 day'
        LEFT JOIN public.bill_submissions bs ON bs.status = 'approved' AND bs.created_at >= g.day AND bs.created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_dist_share_spark;

    -- Super distributor share sparkline
    SELECT ARRAY(
        SELECT COALESCE(SUM(super_distributor_share), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.payment_submissions ON status = 'approved' AND created_at >= g.day AND created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_super_dist_share_spark;

    -- Payout charges sparkline only
    SELECT ARRAY(
        SELECT COALESCE(SUM(charge_amount), 0)
        FROM generate_series(now() - interval '6 days', now(), interval '1 day') AS g(day)
        LEFT JOIN public.payout_submissions ON status = 'approved' AND created_at >= g.day AND created_at < g.day + interval '1 day'
        GROUP BY g.day
        ORDER BY g.day
    ) INTO v_payout_charges_spark_only;

    -- 9. Return everything unified in one JSONB payload
    RETURN jsonb_build_object(
        'current_stats', jsonb_build_object(
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
        ),
        'prev_stats', jsonb_build_object(
            'range_qr_amount', v_prev_range_qr_amount,
            'range_bill_amount', v_prev_range_bill_amount,
            'range_payout_amount', v_prev_range_payout_amount,
            'admin_qr_charges', v_prev_admin_qr_charges,
            'admin_bill_charges', v_prev_admin_bill_charges,
            'range_payout_charges', v_prev_range_payout_charges,
            'total_distributor_share', v_prev_total_distributor_share,
            'total_super_distributor_share', v_prev_total_super_distributor_share
        ),
        'bbps_current', jsonb_build_object(
            'amount', v_bbps_amount,
            'charges', v_bbps_charges,
            'pending_count', v_pending_bbps_count
        ),
        'bbps_prev', jsonb_build_object(
            'amount', v_prev_bbps_amount,
            'charges', v_prev_bbps_charges
        ),
        'user_reg_current', v_current_users_reg,
        'user_reg_prev', v_prev_users_reg,
        'sparklines', jsonb_build_object(
            'qrSpark', v_qr_spark,
            'ccSpark', v_cc_spark,
            'bbpsSpark', v_bbps_spark,
            'userSpark', v_user_spark,
            'qrChargesSpark', v_qr_charges_spark,
            'billChargesSpark', v_bill_charges_spark,
            'bbpsChargesSpark', v_bbps_charges_spark,
            'payoutChargesSpark', v_payout_charges_spark,
            'distShareSpark', v_dist_share_spark,
            'superDistShareSpark', v_super_dist_share_spark,
            'payoutChargesSparkOnly', v_payout_charges_spark_only
        )
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
