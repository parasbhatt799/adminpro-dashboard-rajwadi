-- 1. Create b2b_admin_bank_accounts table
CREATE TABLE IF NOT EXISTS public.b2b_admin_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    branch_name TEXT,
    upi_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.b2b_admin_bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "b2b_admin_bank_accounts_all" ON public.b2b_admin_bank_accounts;
CREATE POLICY "b2b_admin_bank_accounts_all" ON public.b2b_admin_bank_accounts FOR ALL USING (true) WITH CHECK (true);

-- 2. Add admin bank fields to b2b_fund_requests
ALTER TABLE public.b2b_fund_requests ADD COLUMN IF NOT EXISTS admin_bank_account_id UUID REFERENCES public.b2b_admin_bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.b2b_fund_requests ADD COLUMN IF NOT EXISTS admin_bank_details JSONB;
