-- Create b2b_revenue_withdrawals table
CREATE TABLE IF NOT EXISTS public.b2b_revenue_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('developer', 'owner')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    remark TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.b2b_revenue_withdrawals ENABLE ROW LEVEL SECURITY;

-- Allow full access for authenticated, service_role, and anon
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.b2b_revenue_withdrawals;
CREATE POLICY "Allow full access for authenticated users" ON public.b2b_revenue_withdrawals
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access for service_role" ON public.b2b_revenue_withdrawals;
CREATE POLICY "Allow full access for service_role" ON public.b2b_revenue_withdrawals
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access for anon" ON public.b2b_revenue_withdrawals;
CREATE POLICY "Allow full access for anon" ON public.b2b_revenue_withdrawals
    FOR ALL TO anon USING (true) WITH CHECK (true);
