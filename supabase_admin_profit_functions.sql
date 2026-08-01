-- Atomic Admin Balance Updates
-- Run this in your Supabase SQL Editor

-- 1. Atomic RPC for adding/deducting admin profit balance
CREATE OR REPLACE FUNCTION add_admin_balance(
    p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
    row_found BOOLEAN;
BEGIN
    -- Lock the row for update (id 1 is the global admin settings)
    PERFORM 1 FROM public.qr_settings WHERE id = 1 FOR UPDATE;
    
    IF NOT FOUND THEN
        -- If no qr_settings exists yet, create it.
        INSERT INTO public.qr_settings (id, admin_balance) VALUES (1, p_amount) ON CONFLICT (id) DO NOTHING;
        RETURN TRUE;
    END IF;

    UPDATE public.qr_settings 
    SET admin_balance = admin_balance + p_amount 
    WHERE id = 1;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
