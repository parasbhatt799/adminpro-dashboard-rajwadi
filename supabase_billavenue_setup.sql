-- =============================================================
-- DATABASE SETUP FOR BILLAVENUE BBPS INTEGRATION
-- =============================================================
-- Run this script in your Supabase SQL Editor to create the tables.

-- 1. Create Biller Master Table
CREATE TABLE IF NOT EXISTS public.billavenue_billers (
    biller_id TEXT PRIMARY KEY,
    biller_name TEXT NOT NULL,
    category TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Transaction History Table
CREATE TABLE IF NOT EXISTS public.billavenue_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT UNIQUE NOT NULL,
    txn_ref_id TEXT,
    customer_mobile TEXT NOT NULL,
    amount NUMERIC NOT NULL, -- in Rupees
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Complaints Logging Table
CREATE TABLE IF NOT EXISTS public.billavenue_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id TEXT UNIQUE NOT NULL,
    request_id TEXT,
    customer_mobile TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'failed')),
    response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Recharge Plans Table
CREATE TABLE IF NOT EXISTS public.billavenue_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    biller_id TEXT NOT NULL,
    plan_name TEXT,
    amount NUMERIC NOT NULL,
    validity TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) for dynamic public/admin/user backend flow or Enable and create all-access policies
ALTER TABLE public.billavenue_billers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billavenue_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billavenue_complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billavenue_plans DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
