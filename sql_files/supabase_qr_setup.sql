-- 1. Create the qr_settings table
CREATE TABLE IF NOT EXISTS public.qr_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    qr_url TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row_only CHECK (id = 1)
);

-- 2. Insert the initial row if it doesn't exist
INSERT INTO public.qr_settings (id, is_enabled)
VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE public.qr_settings ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies
CREATE POLICY "Allow public read access" ON public.qr_settings FOR SELECT USING (true);
CREATE POLICY "Allow public update access" ON public.qr_settings FOR UPDATE USING (true);

-- 5. Create storage bucket for QR codes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('qr_codes', 'qr_codes', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage Policies
CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'qr_codes');
CREATE POLICY "Allow public view" ON storage.objects FOR SELECT USING (bucket_id = 'qr_codes');
CREATE POLICY "Allow public delete" ON storage.objects FOR DELETE USING (bucket_id = 'qr_codes');
CREATE POLICY "Allow public update" ON storage.objects FOR UPDATE USING (bucket_id = 'qr_codes');
