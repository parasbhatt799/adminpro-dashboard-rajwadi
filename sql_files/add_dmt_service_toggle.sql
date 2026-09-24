-- SQL Migration: Add independent toggle for DMT (Direct Money Transfer) service
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS is_dmt_enabled BOOLEAN DEFAULT TRUE;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
