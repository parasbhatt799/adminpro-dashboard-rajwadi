-- =============================================================
-- DATABASE SETUP FOR CAMLENIO AEPS INTEGRATION
-- =============================================================
-- Run this script in your Supabase SQL Editor to create the tables.

-- 1. Create AEPS Agent Onboarding Table
CREATE TABLE IF NOT EXISTS public.aeps_agents (
    user_id TEXT PRIMARY KEY REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    reference_key TEXT UNIQUE NOT NULL,
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
    daily_login_date DATE,
    registration_data JSONB DEFAULT '{}'::jsonb,
    kyc_response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create AEPS Transactions Table
CREATE TABLE IF NOT EXISTS public.aeps_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('balance_enquiry', 'cash_withdrawal', 'mini_statement')),
    customer_mobile TEXT NOT NULL,
    bank_iin TEXT NOT NULL,
    amount NUMERIC DEFAULT 0, -- in Rupees
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    external_ref TEXT UNIQUE NOT NULL,
    api_response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) for dynamic backend access
ALTER TABLE public.aeps_agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.aeps_transactions DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
