-- Add share columns to submissions to "freeze" historical profit data
ALTER TABLE public.payment_submissions 
ADD COLUMN IF NOT EXISTS admin_share NUMERIC,
ADD COLUMN IF NOT EXISTS distributor_share NUMERIC;

ALTER TABLE public.bill_submissions 
ADD COLUMN IF NOT EXISTS admin_share NUMERIC,
ADD COLUMN IF NOT EXISTS distributor_share NUMERIC;

-- Migration: Populate existing approved records with current split logic (best effort)
-- This will ensure that even if distributors are deleted tomorrow, today's historical data is safe.
DO $$
BEGIN
    -- Update payment_submissions: Split based on distributor base charge
    UPDATE public.payment_submissions ps
    SET 
        admin_share = CASE 
            WHEN up.distributor_id IS NOT NULL AND dist.role = 'distributor' THEN (ps.amount * dist.admin_base_qr_charge / 100)
            ELSE ps.charges
        END,
        distributor_share = CASE 
            WHEN up.distributor_id IS NOT NULL AND dist.role = 'distributor' THEN ps.charges - (ps.amount * dist.admin_base_qr_charge / 100)
            ELSE 0
        END
    FROM public.users_profiles up
    LEFT JOIN public.users_profiles dist ON up.distributor_id = dist.id
    WHERE ps.user_id = up.id AND ps.status = 'approved' AND ps.admin_share IS NULL;

    -- Update bill_submissions: Always full charges for Admin (No distributor split for bills)
    UPDATE public.bill_submissions bs
    SET 
        admin_share = bs.charges,
        distributor_share = 0
    WHERE bs.status = 'approved' AND bs.admin_share IS NULL;
END $$;
