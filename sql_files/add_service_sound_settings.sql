-- Add separate ON and OFF sound settings to qr_settings
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS service_on_sound_url TEXT DEFAULT 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
ADD COLUMN IF NOT EXISTS service_off_sound_url TEXT DEFAULT 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

-- Drop the single sound url we added previously if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='qr_settings' AND column_name='service_sound_url') THEN
        ALTER TABLE public.qr_settings DROP COLUMN service_sound_url;
    END IF;
END $$;
