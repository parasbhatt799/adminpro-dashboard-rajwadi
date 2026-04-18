-- 1. Create qr_history table
CREATE TABLE IF NOT EXISTS public.qr_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_name TEXT NOT NULL,
    qr_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add qr_id column to payment_submissions
ALTER TABLE public.payment_submissions 
ADD COLUMN IF NOT EXISTS qr_id UUID REFERENCES public.qr_history(id) ON DELETE SET NULL;

-- 3. Enable RLS for qr_history
ALTER TABLE public.qr_history ENABLE ROW LEVEL SECURITY;

-- 4. Policies for qr_history
CREATE POLICY "Allow public read qr_history" ON public.qr_history FOR SELECT USING (true);
CREATE POLICY "Allow admin all qr_history" ON public.qr_history FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.users_profiles
        WHERE id = (auth.uid())::text AND role = 'admin'
    )
);

-- 5. Seed initial active QR if qr_settings has data
INSERT INTO public.qr_history (qr_name, qr_url, is_active)
SELECT 'Initial QR', qr_url, true
FROM public.qr_settings
WHERE qr_url IS NOT NULL AND id = 1
ON CONFLICT DO NOTHING;

-- Update existing submissions to link to the initial QR if it exists
DO $$
DECLARE
    initial_qr_id UUID;
BEGIN
    SELECT id INTO initial_qr_id FROM public.qr_history WHERE qr_name = 'Initial QR' LIMIT 1;
    IF initial_qr_id IS NOT NULL THEN
        UPDATE public.payment_submissions SET qr_id = initial_qr_id WHERE qr_id IS NULL;
    END IF;
END $$;
