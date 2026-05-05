-- Add separate enable flags for service ON and OFF sounds
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS is_service_on_sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_service_off_sound_enabled BOOLEAN DEFAULT true;
