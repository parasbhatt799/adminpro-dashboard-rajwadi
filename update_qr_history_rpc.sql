-- =========================================================================
-- SQL MIGRATION TO UPDATE QR HISTORY STATS RPC WITH SUPER DISTRIBUTOR CHARGE
-- Run this in your Supabase SQL Editor to apply database updates.
-- =========================================================================

-- 1. Drop the old overloaded functions to resolve candidate ambiguity
DROP FUNCTION IF EXISTS public.get_qr_history_with_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_qr_history_with_stats(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

-- 2. Create the updated function with super_distributor_share in the return signature
CREATE OR REPLACE FUNCTION public.get_qr_history_with_stats(
    search_term TEXT DEFAULT '',
    time_start TIMESTAMPTZ DEFAULT NULL,
    time_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    qr_name TEXT,
    qr_url TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    whatsapp_number TEXT,
    profit_percentage NUMERIC,
    total_count BIGINT,
    pending_count BIGINT,
    approved_count BIGINT,
    rejected_count BIGINT,
    total_amount NUMERIC,
    admin_share NUMERIC,
    super_distributor_share NUMERIC,
    distributor_share NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.qr_name,
        q.qr_url,
        q.is_active,
        q.created_at,
        q.whatsapp_number,
        COALESCE(q.profit_percentage, 0)::NUMERIC as profit_percentage,
        COUNT(p.id)::BIGINT as total_count,
        COUNT(CASE WHEN p.status = 'pending' THEN 1 END)::BIGINT as pending_count,
        COUNT(CASE WHEN p.status = 'approved' THEN 1 END)::BIGINT as approved_count,
        COUNT(CASE WHEN p.status = 'rejected' THEN 1 END)::BIGINT as rejected_count,
        COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.amount ELSE 0 END), 0)::NUMERIC as total_amount,
        COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.admin_share ELSE 0 END), 0)::NUMERIC as admin_share,
        COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.super_distributor_share ELSE 0 END), 0)::NUMERIC as super_distributor_share,
        COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.distributor_share ELSE 0 END), 0)::NUMERIC as distributor_share
    FROM public.qr_history q
    LEFT JOIN public.payment_submissions p ON p.qr_id = q.id 
        AND (time_start IS NULL OR p.created_at >= time_start)
        AND (time_end IS NULL OR p.created_at <= time_end)
    WHERE (search_term = '' OR q.qr_name ILIKE '%' || search_term || '%')
    GROUP BY q.id
    ORDER BY q.created_at DESC;
END;
$$;

-- 3. Reload PostgREST schema cache to make sure the API updates immediately
NOTIFY pgrst, 'reload schema';
