-- Add Fund Transfer Service On/Off Toggle Column to public.qr_settings
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS is_fund_transfer_enabled BOOLEAN DEFAULT TRUE;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
