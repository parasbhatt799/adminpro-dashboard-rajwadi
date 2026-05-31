-- Add BBPS Max Limit Column to qr_settings
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS bbps_max_limit NUMERIC DEFAULT 50000;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
