-- 1. Add wallet balance column
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(15,2) DEFAULT 0.00;

-- 2. Create b2b_fund_requests table
CREATE TABLE IF NOT EXISTS public.b2b_fund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.b2b_api_credentials(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    utr_number TEXT NOT NULL,
    proof_url TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and add full access policy (app relies on custom application logic instead of Supabase Auth)
ALTER TABLE public.b2b_fund_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "b2b_fund_requests_all" ON public.b2b_fund_requests;
CREATE POLICY "b2b_fund_requests_all" ON public.b2b_fund_requests FOR ALL USING (true) WITH CHECK (true);

-- 3. Create Atomic RPC for deducting balance
CREATE OR REPLACE FUNCTION deduct_b2b_wallet_balance(
    p_agent_id UUID,
    p_amount DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    current_balance DECIMAL;
BEGIN
    -- Lock the row for update to prevent race conditions
    SELECT wallet_balance INTO current_balance 
    FROM public.b2b_api_credentials 
    WHERE id = p_agent_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF current_balance >= p_amount THEN
        UPDATE public.b2b_api_credentials 
        SET wallet_balance = wallet_balance - p_amount 
        WHERE id = p_agent_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create Atomic RPC for adding balance
CREATE OR REPLACE FUNCTION add_b2b_wallet_balance(
    p_agent_id UUID,
    p_amount DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    row_found BOOLEAN;
BEGIN
    -- Lock the row for update
    PERFORM 1 FROM public.b2b_api_credentials WHERE id = p_agent_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    UPDATE public.b2b_api_credentials 
    SET wallet_balance = wallet_balance + p_amount 
    WHERE id = p_agent_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
