-- =========================================================================
-- B2B PAYOUT WALLET, CUSTOM SLABS, AND DUAL-SERVICE SETUP
-- Run this script in the Supabase SQL Editor
-- =========================================================================

-- 1. Add Payout Wallet & Service Control Columns to b2b_api_credentials
ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS payout_wallet_balance NUMERIC(15,2) DEFAULT 0.00;

ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS is_bbps_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS is_payout_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS payout_slabs JSONB DEFAULT NULL;

-- 2. Add wallet_type column to b2b_fund_requests ('bbps' or 'payout')
ALTER TABLE public.b2b_fund_requests 
ADD COLUMN IF NOT EXISTS wallet_type TEXT DEFAULT 'bbps';

-- Create check constraint if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_b2b_fund_request_wallet_type'
    ) THEN
        ALTER TABLE public.b2b_fund_requests 
        ADD CONSTRAINT chk_b2b_fund_request_wallet_type 
        CHECK (wallet_type IN ('bbps', 'payout'));
    END IF;
END $$;

-- 3. Atomic RPC to Process Fund Requests (Supports both BBPS and Payout Wallets)
CREATE OR REPLACE FUNCTION public.process_b2b_fund_request_atomic(
    p_request_id UUID,
    p_action TEXT -- 'approve', 'reject', or 'revert_approved'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_wallet TEXT;
BEGIN
    -- 1. Lock the fund request row FOR UPDATE to prevent race conditions
    SELECT * INTO v_req 
    FROM public.b2b_fund_requests 
    WHERE id = p_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Fund request not found');
    END IF;

    -- Determine wallet target ('bbps' or 'payout')
    v_wallet := LOWER(COALESCE(v_req.wallet_type, 'bbps'));
    IF v_wallet NOT IN ('bbps', 'payout') THEN
        v_wallet := 'bbps';
    END IF;

    -- 2. Handle APPROVE
    IF p_action = 'approve' THEN
        IF v_req.status != 'pending' THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'This fund request has already been processed (' || v_req.status || '). Double credit prevented!'
            );
        END IF;

        -- Lock agent credentials row
        PERFORM 1 FROM public.b2b_api_credentials WHERE id = v_req.agent_id FOR UPDATE;

        IF v_wallet = 'payout' THEN
            -- Credit to Payout Wallet
            UPDATE public.b2b_api_credentials 
            SET payout_wallet_balance = COALESCE(payout_wallet_balance, 0) + v_req.amount 
            WHERE id = v_req.agent_id;
        ELSE
            -- Credit to BBPS / Utility Wallet
            UPDATE public.b2b_api_credentials 
            SET wallet_balance = COALESCE(wallet_balance, 0) + v_req.amount 
            WHERE id = v_req.agent_id;
        END IF;

        -- Update fund request status to approved
        UPDATE public.b2b_fund_requests 
        SET status = 'approved', updated_at = NOW() 
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Fund request approved and balance credited to ' || UPPER(v_wallet) || ' wallet successfully', 
            'amount', v_req.amount,
            'agent_id', v_req.agent_id,
            'wallet_type', v_wallet
        );

    -- 3. Handle REVERT APPROVED
    ELSIF p_action = 'revert_approved' THEN
        IF v_req.status != 'approved' THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Fund request is not in approved state (' || v_req.status || ').'
            );
        END IF;

        PERFORM 1 FROM public.b2b_api_credentials WHERE id = v_req.agent_id FOR UPDATE;

        IF v_wallet = 'payout' THEN
            UPDATE public.b2b_api_credentials 
            SET payout_wallet_balance = COALESCE(payout_wallet_balance, 0) - v_req.amount 
            WHERE id = v_req.agent_id;
        ELSE
            UPDATE public.b2b_api_credentials 
            SET wallet_balance = COALESCE(wallet_balance, 0) - v_req.amount 
            WHERE id = v_req.agent_id;
        END IF;

        UPDATE public.b2b_fund_requests 
        SET status = 'rejected', updated_at = NOW() 
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Fund request reverted and balance deducted from ' || UPPER(v_wallet) || ' wallet successfully', 
            'amount', v_req.amount,
            'agent_id', v_req.agent_id,
            'wallet_type', v_wallet
        );

    -- 4. Handle REJECT (when pending)
    ELSIF p_action = 'reject' THEN
        IF v_req.status != 'pending' THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Fund request is already processed (' || v_req.status || ').'
            );
        END IF;

        UPDATE public.b2b_fund_requests 
        SET status = 'rejected', updated_at = NOW() 
        WHERE id = p_request_id;

        RETURN jsonb_build_object('success', true, 'message', 'Fund request rejected');

    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid action: ' || p_action);
    END IF;
END;
$$;

-- 4. Helper RPC: Atomic add/deduct for Payout Wallet
CREATE OR REPLACE FUNCTION public.add_b2b_payout_wallet(
    p_agent_id UUID,
    p_amount NUMERIC
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.b2b_api_credentials
    SET payout_wallet_balance = COALESCE(payout_wallet_balance, 0) + p_amount
    WHERE id = p_agent_id;
    
    RETURN FOUND;
END;
$$;

-- 5. Helper RPC: Atomic deduct from Payout Wallet with sufficient balance guard
CREATE OR REPLACE FUNCTION public.deduct_b2b_payout_wallet(
    p_agent_id UUID,
    p_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_bal NUMERIC;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amount must be greater than 0');
    END IF;

    -- Lock row for update
    SELECT payout_wallet_balance INTO v_current_bal
    FROM public.b2b_api_credentials
    WHERE id = p_agent_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Agent not found');
    END IF;

    v_current_bal := COALESCE(v_current_bal, 0);

    IF v_current_bal < p_amount THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Insufficient payout wallet balance',
            'current_balance', v_current_bal,
            'required', p_amount
        );
    END IF;

    UPDATE public.b2b_api_credentials
    SET payout_wallet_balance = v_current_bal - p_amount
    WHERE id = p_agent_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Balance deducted successfully',
        'previous_balance', v_current_bal,
        'new_balance', v_current_bal - p_amount
    );
END;
$$;

-- 6. Create b2b_payout_transactions Table for API logs & reporting
CREATE TABLE IF NOT EXISTS public.b2b_payout_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.b2b_api_credentials(id) ON DELETE SET NULL,
    order_id TEXT UNIQUE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    charge NUMERIC(15,2) DEFAULT 0.00,
    total_deducted NUMERIC(15,2) NOT NULL,
    beneficiary_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    bank_name TEXT,
    transfer_mode TEXT DEFAULT 'IMPS',
    status TEXT DEFAULT 'pending', -- 'success', 'pending', 'failed', 'refunded'
    utr TEXT,
    api_txn_id TEXT,
    error_message TEXT,
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and set open policy
ALTER TABLE public.b2b_payout_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "b2b_payout_transactions_all" ON public.b2b_payout_transactions;
CREATE POLICY "b2b_payout_transactions_all" ON public.b2b_payout_transactions FOR ALL USING (true) WITH CHECK (true);

-- Index for speedy lookups
CREATE INDEX IF NOT EXISTS idx_b2b_payout_order_id ON public.b2b_payout_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_b2b_payout_agent_id ON public.b2b_payout_transactions(agent_id);

-- Optional: Add client_order_id column and index if updating existing table
ALTER TABLE public.b2b_payout_transactions ADD COLUMN IF NOT EXISTS client_order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_b2b_payout_client_order_id ON public.b2b_payout_transactions(client_order_id);
