-- 1. Create the service_charge_slabs table
CREATE TABLE IF NOT EXISTS public.service_charge_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_amount NUMERIC NOT NULL DEFAULT 0,
    max_amount NUMERIC NOT NULL,
    charge_amount NUMERIC NOT NULL,
    is_percentage BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.service_charge_slabs ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_charge_slabs_public_read') THEN
        CREATE POLICY "service_charge_slabs_public_read" ON public.service_charge_slabs FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_charge_slabs_public_insert') THEN
        CREATE POLICY "service_charge_slabs_public_insert" ON public.service_charge_slabs FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_charge_slabs_public_update') THEN
        CREATE POLICY "service_charge_slabs_public_update" ON public.service_charge_slabs FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_charge_slabs_public_delete') THEN
        CREATE POLICY "service_charge_slabs_public_delete" ON public.service_charge_slabs FOR DELETE USING (true);
    END IF;
END $$;

-- 4. Insert some default slabs
INSERT INTO public.service_charge_slabs (min_amount, max_amount, charge_amount, is_percentage)
VALUES 
    (0, 1000, 10, FALSE),
    (1001, 5000, 50, FALSE),
    (5001, 10000, 100, FALSE),
    (10001, 100000, 1, TRUE)
ON CONFLICT DO NOTHING;
