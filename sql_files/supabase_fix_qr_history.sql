-- 1. Add missing columns to qr_history
ALTER TABLE public.qr_history 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 2. Fix whatsapp_api_settings table (ensure is_active exists instead of or along with is_enabled)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_api_settings' AND column_name = 'is_enabled') THEN
        ALTER TABLE public.whatsapp_api_settings RENAME COLUMN is_enabled TO is_active;
    ELSE
        ALTER TABLE public.whatsapp_api_settings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Update existing data if necessary
UPDATE public.qr_history SET is_active = true WHERE id IN (SELECT id FROM public.qr_history ORDER BY created_at DESC LIMIT 1);

-- 4. Refresh the schema cache
NOTIFY pgrst, 'reload schema';
