-- ==========================================================
-- BillAvenue DMT (Direct Money Transfer) Schema v1.9.3
-- Supports Sender Onboarding, Recipients, Fund Transfer & Refunds
-- ==========================================================

-- 1. DMT Senders
CREATE TABLE IF NOT EXISTS public.dmt_senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_mobile VARCHAR(15) UNIQUE NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    pincode VARCHAR(10),
    city VARCHAR(100),
    state VARCHAR(100),
    aadhar_number VARCHAR(20),
    is_kyc_verified BOOLEAN DEFAULT FALSE,
    bank_id VARCHAR(10) DEFAULT 'ARTL', -- 'ARTL' or 'FINO'
    total_monthly_limit NUMERIC(12, 2) DEFAULT 25000.00,
    used_monthly_limit NUMERIC(12, 2) DEFAULT 0.00,
    available_limit NUMERIC(12, 2) DEFAULT 25000.00,
    additional_limit_available BOOLEAN DEFAULT FALSE,
    raw_profile JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on mobile for ultra-fast lookup
CREATE INDEX IF NOT EXISTS idx_dmt_senders_mobile ON public.dmt_senders(sender_mobile);

-- 2. DMT Recipients (Beneficiaries)
CREATE TABLE IF NOT EXISTS public.dmt_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_mobile VARCHAR(15) NOT NULL,
    recipient_id VARCHAR(50), -- BillAvenue recipient ID
    recipient_name VARCHAR(255) NOT NULL,
    recipient_mobile VARCHAR(15),
    bank_code VARCHAR(20) NOT NULL,
    bank_name VARCHAR(255),
    bank_account VARCHAR(50) NOT NULL,
    ifsc VARCHAR(20) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_name VARCHAR(255),
    status VARCHAR(10) DEFAULT 'E', -- 'E' = Enabled, 'D' = Deleted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dmt_recipients_sender ON public.dmt_recipients(sender_mobile);
CREATE INDEX IF NOT EXISTS idx_dmt_recipients_acc ON public.dmt_recipients(bank_account);

-- 3. DMT Transactions
CREATE TABLE IF NOT EXISTS public.dmt_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    sender_mobile VARCHAR(15) NOT NULL,
    recipient_id VARCHAR(50),
    recipient_name VARCHAR(255),
    bank_account VARCHAR(50),
    ifsc VARCHAR(20),
    bank_name VARCHAR(255),
    amount NUMERIC(12, 2) NOT NULL,
    charge_amount NUMERIC(12, 2) DEFAULT 10.00,
    txn_type VARCHAR(10) DEFAULT 'IMPS', -- 'IMPS' or 'NEFT'
    bank_id VARCHAR(10) DEFAULT 'ARTL',
    unique_ref_id VARCHAR(64) UNIQUE, -- 35-char BillAvenue ref ID
    bank_txn_id VARCHAR(64),
    dmt_txn_id VARCHAR(64),
    ref_id VARCHAR(64),
    txn_status VARCHAR(10) DEFAULT 'C', -- C=Success, P=Initiated, Q=Pending, F=Failed, T=Refund Pending, R=Refunded
    remark TEXT,
    refund_txn_id VARCHAR(64),
    refund_status VARCHAR(20),
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dmt_txn_mobile ON public.dmt_transactions(sender_mobile);
CREATE INDEX IF NOT EXISTS idx_dmt_txn_unique_ref ON public.dmt_transactions(unique_ref_id);
CREATE INDEX IF NOT EXISTS idx_dmt_txn_status ON public.dmt_transactions(txn_status);

-- 4. Enable RLS and public access policies
ALTER TABLE public.dmt_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dmt_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dmt_transactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select on dmt_senders') THEN
        CREATE POLICY "Allow public select on dmt_senders" ON public.dmt_senders FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select on dmt_recipients') THEN
        CREATE POLICY "Allow public select on dmt_recipients" ON public.dmt_recipients FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select on dmt_transactions') THEN
        CREATE POLICY "Allow public select on dmt_transactions" ON public.dmt_transactions FOR ALL USING (true);
    END IF;
END $$;
