-- 1. Add whatsapp_number to qr_history
ALTER TABLE public.qr_history 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 2. Create whatsapp_api_settings table for credentials
CREATE TABLE IF NOT EXISTS public.whatsapp_api_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_active BOOLEAN DEFAULT FALSE,
    provider TEXT DEFAULT 'meta',
    access_token TEXT,
    phone_number_id TEXT,
    sender_number TEXT,
    aisensy_api_key TEXT,
    aisensy_campaign_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.whatsapp_api_settings ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "whatsapp_settings_all" ON public.whatsapp_api_settings;
CREATE POLICY "whatsapp_settings_all" ON public.whatsapp_api_settings FOR ALL USING (true) WITH CHECK (true);

-- 5. Seed initial row if not exists
INSERT INTO public.whatsapp_api_settings (id, is_active)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- 6. Add new columns if table already exists
ALTER TABLE public.whatsapp_api_settings ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'meta';
ALTER TABLE public.whatsapp_api_settings ADD COLUMN IF NOT EXISTS aisensy_api_key TEXT;
ALTER TABLE public.whatsapp_api_settings ADD COLUMN IF NOT EXISTS aisensy_campaign_name TEXT;
