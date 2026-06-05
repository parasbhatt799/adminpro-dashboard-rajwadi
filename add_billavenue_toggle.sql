-- SQL Migration: Add independent toggle for BillAvenue payment
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS is_billavenue_enabled BOOLEAN DEFAULT TRUE;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
