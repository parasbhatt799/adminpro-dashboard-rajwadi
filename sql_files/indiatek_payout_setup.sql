-- ==========================================================
-- INDIATEK PAYOUT INTEGRATION SCHEMA
-- ==========================================================

-- 1. Create indiatek_payout_settings table
CREATE TABLE IF NOT EXISTS public.indiatek_payout_settings (
    id INT PRIMARY KEY DEFAULT 1,
    username TEXT DEFAULT '',
    api_secret TEXT DEFAULT '$2y$12$KpOhRX4vBdqLjsAr3mJeTOd6oKAVauwwlWqkdPJEpXqO6HBTkCvgC',
    is_active BOOLEAN DEFAULT TRUE,
    charge_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial default row if missing
INSERT INTO public.indiatek_payout_settings (id, username, api_secret, is_active)
VALUES (1, '', '$2y$12$KpOhRX4vBdqLjsAr3mJeTOd6oKAVauwwlWqkdPJEpXqO6HBTkCvgC', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create indiatek_payout_submissions table
CREATE TABLE IF NOT EXISTS public.indiatek_payout_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    beneficiary_name TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    partner_reference TEXT UNIQUE NOT NULL,
    transaction_id TEXT,
    status TEXT DEFAULT 'PENDING',
    charges NUMERIC DEFAULT 0,
    response_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add basic policies
ALTER TABLE public.indiatek_payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indiatek_payout_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all authenticated users" ON public.indiatek_payout_settings;
CREATE POLICY "Enable read for all authenticated users" ON public.indiatek_payout_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for service role and admin" ON public.indiatek_payout_settings;
CREATE POLICY "Enable all access for service role and admin" ON public.indiatek_payout_settings FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all access for indiatek submissions" ON public.indiatek_payout_submissions;
CREATE POLICY "Enable all access for indiatek submissions" ON public.indiatek_payout_submissions FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
