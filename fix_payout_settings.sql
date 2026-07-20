-- 1. Ensure RLS is enabled but allows all operations so admin can save settings
ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payout_settings_all" ON public.payout_settings;
CREATE POLICY "payout_settings_all" ON public.payout_settings FOR ALL USING (true) WITH CHECK (true);

-- 2. Make sure the id=1 row actually exists, otherwise upsert/update can fail
INSERT INTO public.payout_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. Make sure all Camlenio columns exist
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS camlenio_is_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS camlenio_max_payout NUMERIC DEFAULT 50000;
ALTER TABLE public.payout_settings ADD COLUMN IF NOT EXISTS camlenio_verification_charge NUMERIC DEFAULT 5;
