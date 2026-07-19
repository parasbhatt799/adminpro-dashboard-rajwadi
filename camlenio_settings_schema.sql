-- Add Camlenio settings to payout_settings table
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS camlenio_is_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS camlenio_max_payout NUMERIC DEFAULT 50000;
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS camlenio_verification_charge NUMERIC DEFAULT 5;
