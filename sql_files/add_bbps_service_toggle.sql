-- Add BBPS Service On/Off Toggle Column to qr_settings
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS is_bbps_enabled BOOLEAN DEFAULT true;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
