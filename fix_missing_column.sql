-- Add the missing column for enabling/disabling the service sound
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS is_service_sound_enabled BOOLEAN DEFAULT true;
