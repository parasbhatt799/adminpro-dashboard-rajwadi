-- 1. Create the bank_details table
CREATE TABLE IF NOT EXISTS public.bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    account_holder TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    branch_name TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bank_details_public_read') THEN
        CREATE POLICY "bank_details_public_read" ON public.bank_details FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bank_details_public_insert') THEN
        CREATE POLICY "bank_details_public_insert" ON public.bank_details FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bank_details_public_update') THEN
        CREATE POLICY "bank_details_public_update" ON public.bank_details FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bank_details_public_delete') THEN
        CREATE POLICY "bank_details_public_delete" ON public.bank_details FOR DELETE USING (true);
    END IF;
END $$;

-- 4. Insert initial row (if not exists)
INSERT INTO public.bank_details (bank_name, is_active)
VALUES 
    ('HDFC Bank', TRUE),
    ('ICICI Bank', TRUE),
    ('State Bank of India', TRUE),
    ('Axis Bank', TRUE),
    ('Kotak Mahindra Bank', TRUE),
    ('Punjab National Bank', TRUE),
    ('Bank of Baroda', TRUE),
    ('Canara Bank', TRUE),
    ('Union Bank of India', TRUE),
    ('IndusInd Bank', TRUE)
ON CONFLICT DO NOTHING;

-- 5. Create storage bucket for bank logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bank_logos', 'bank_logos', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bank_logos_allow_public_upload') THEN
        CREATE POLICY "bank_logos_allow_public_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'bank_logos');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bank_logos_allow_public_view') THEN
        CREATE POLICY "bank_logos_allow_public_view" ON storage.objects FOR SELECT USING (bucket_id = 'bank_logos');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bank_logos_allow_public_delete') THEN
        CREATE POLICY "bank_logos_allow_public_delete" ON storage.objects FOR DELETE USING (bucket_id = 'bank_logos');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bank_logos_allow_public_update') THEN
        CREATE POLICY "bank_logos_allow_public_update" ON storage.objects FOR UPDATE USING (bucket_id = 'bank_logos');
    END IF;
END $$;
