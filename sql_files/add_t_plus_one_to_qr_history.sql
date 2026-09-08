-- ==========================================================
-- MIGRATION: ADD t_plus_one COLUMN TO public.qr_history
-- AND UPDATE get_qr_history_with_stats RPC
-- ==========================================================

-- 1. Add t_plus_one column to qr_history table if it doesn't exist
ALTER TABLE public.qr_history ADD COLUMN IF NOT EXISTS t_plus_one BOOLEAN DEFAULT FALSE;

-- 2. Drop the old function to avoid parameter/return conflicts
DROP FUNCTION IF EXISTS public.get_qr_history_with_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

-- 3. Create the updated function with t_plus_one column in the return signature
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
    t_plus_one BOOLEAN,
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
        COALESCE(q.t_plus_one, false)::BOOLEAN as t_plus_one,
        COUNT(p.id)::BIGINT as total_count,
        COUNT(CASE WHEN p.status = 'pending' THEN 1 END)::BIGINT as pending_count,
        COUNT(CASE WHEN p.status IN ('approved', 'T+1 Approved') THEN 1 END)::BIGINT as approved_count,
        COUNT(CASE WHEN p.status = 'rejected' THEN 1 END)::BIGINT as rejected_count,
        COALESCE(SUM(CASE WHEN p.status IN ('approved', 'T+1 Approved') THEN p.amount ELSE 0 END), 0)::NUMERIC as total_amount,
        COALESCE(SUM(CASE WHEN p.status IN ('approved', 'T+1 Approved') THEN p.admin_share ELSE 0 END), 0)::NUMERIC as admin_share,
        COALESCE(SUM(CASE WHEN p.status IN ('approved', 'T+1 Approved') THEN p.super_distributor_share ELSE 0 END), 0)::NUMERIC as super_distributor_share,
        COALESCE(SUM(CASE WHEN p.status IN ('approved', 'T+1 Approved') THEN p.distributor_share ELSE 0 END), 0)::NUMERIC as distributor_share
    FROM public.qr_history q
    LEFT JOIN public.payment_submissions p ON p.qr_id = q.id 
        AND (time_start IS NULL OR p.created_at >= time_start)
        AND (time_end IS NULL OR p.created_at <= time_end)
    WHERE (search_term = '' OR q.qr_name ILIKE '%' || search_term || '%')
    GROUP BY q.id, q.t_plus_one
    ORDER BY q.created_at DESC;
END;
$$;

-- 4. Reload schema to update PostgREST cache
NOTIFY pgrst, 'reload schema';
