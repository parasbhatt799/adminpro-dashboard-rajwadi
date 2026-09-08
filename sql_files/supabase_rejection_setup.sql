-- 1. Create the rejection_categories table
CREATE TABLE IF NOT EXISTS public.rejection_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create the rejection_reasons table
CREATE TABLE IF NOT EXISTS public.rejection_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.rejection_categories(id) ON DELETE CASCADE,
    reason_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.rejection_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejection_reasons ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for Categories
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rejection_categories_public_read') THEN
        CREATE POLICY "rejection_categories_public_read" ON public.rejection_categories FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rejection_categories_public_insert') THEN
        CREATE POLICY "rejection_categories_public_insert" ON public.rejection_categories FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rejection_categories_public_update') THEN
        CREATE POLICY "rejection_categories_public_update" ON public.rejection_categories FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rejection_categories_public_delete') THEN
        CREATE POLICY "rejection_categories_public_delete" ON public.rejection_categories FOR DELETE USING (true);
    END IF;
END $$;

-- 5. Create Policies for Reasons
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rejection_reasons_public_read') THEN
        CREATE POLICY "rejection_reasons_public_read" ON public.rejection_reasons FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rejection_reasons_public_insert') THEN
        CREATE POLICY "rejection_reasons_public_insert" ON public.rejection_reasons FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rejection_reasons_public_update') THEN
        CREATE POLICY "rejection_reasons_public_update" ON public.rejection_reasons FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rejection_reasons_public_delete') THEN
        CREATE POLICY "rejection_reasons_public_delete" ON public.rejection_reasons FOR DELETE USING (true);
    END IF;
END $$;

-- 6. Insert some default categories
INSERT INTO public.rejection_categories (name)
VALUES 
    ('Document Issues'),
    ('Payment Discrepancy'),
    ('Verification Failed'),
    ('System Error')
ON CONFLICT (name) DO NOTHING;
