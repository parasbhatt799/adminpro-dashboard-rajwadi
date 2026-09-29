-- =========================================================================
-- B2B CSPL WALLET, SERVICE CONTROL, AND ATOMIC FUND REQUEST UPDATE
-- Run this script in the Supabase SQL Editor
-- =========================================================================

-- 1. Add CSPL Wallet & Service Control Columns to b2b_api_credentials
ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS cspl_wallet_balance NUMERIC(15,2) DEFAULT 0.00;

ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS is_cspl_enabled BOOLEAN DEFAULT false;

-- 2. Update wallet_type constraint in b2b_fund_requests ('bbps', 'payout', or 'cspl')
DO $$ 
BEGIN 
    -- Drop existing constraint if it only allowed ('bbps', 'payout')
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_b2b_fund_request_wallet_type'
    ) THEN
        ALTER TABLE public.b2b_fund_requests DROP CONSTRAINT chk_b2b_fund_request_wallet_type;
    END IF;

    -- Add updated constraint allowing ('bbps', 'payout', 'cspl')
    ALTER TABLE public.b2b_fund_requests 
    ADD CONSTRAINT chk_b2b_fund_request_wallet_type 
    CHECK (wallet_type IN ('bbps', 'payout', 'cspl'));
END $$;

-- 3. Atomic RPC to Process Fund Requests (Supports BBPS, Payout, and CSPL Wallets)
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

    -- Determine wallet target ('bbps', 'payout', or 'cspl')
    v_wallet := LOWER(COALESCE(v_req.wallet_type, 'bbps'));
    IF v_wallet NOT IN ('bbps', 'payout', 'cspl') THEN
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
        ELSIF v_wallet = 'cspl' THEN
            -- Credit to CSPL Bill Wallet
            UPDATE public.b2b_api_credentials 
            SET cspl_wallet_balance = COALESCE(cspl_wallet_balance, 0) + v_req.amount 
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

    -- 3. Handle REJECT
    ELSIF p_action = 'reject' THEN
        IF v_req.status != 'pending' THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Only pending requests can be rejected (current: ' || v_req.status || ')'
            );
        END IF;

        UPDATE public.b2b_fund_requests 
        SET status = 'rejected', updated_at = NOW() 
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Fund request rejected successfully',
            'wallet_type', v_wallet
        );

    -- 4. Handle REVERT APPROVED (Reverse credited amount)
    ELSIF p_action = 'revert_approved' THEN
        IF v_req.status != 'approved' THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Only approved requests can be reverted'
            );
        END IF;

        PERFORM 1 FROM public.b2b_api_credentials WHERE id = v_req.agent_id FOR UPDATE;

        IF v_wallet = 'payout' THEN
            UPDATE public.b2b_api_credentials 
            SET payout_wallet_balance = GREATEST(0, COALESCE(payout_wallet_balance, 0) - v_req.amount) 
            WHERE id = v_req.agent_id;
        ELSIF v_wallet = 'cspl' THEN
            UPDATE public.b2b_api_credentials 
            SET cspl_wallet_balance = GREATEST(0, COALESCE(cspl_wallet_balance, 0) - v_req.amount) 
            WHERE id = v_req.agent_id;
        ELSE
            UPDATE public.b2b_api_credentials 
            SET wallet_balance = GREATEST(0, COALESCE(wallet_balance, 0) - v_req.amount) 
            WHERE id = v_req.agent_id;
        END IF;

        UPDATE public.b2b_fund_requests 
        SET status = 'rejected', updated_at = NOW() 
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Approved request reverted and ' || UPPER(v_wallet) || ' wallet balance deducted', 
            'amount', v_req.amount,
            'agent_id', v_req.agent_id,
            'wallet_type', v_wallet
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid action: ' || COALESCE(p_action, 'null'));
    END IF;
END;
$$;

-- 4. Atomic Deduct & Refund RPC for B2B CSPL Wallet
CREATE OR REPLACE FUNCTION public.deduct_b2b_cspl_wallet_balance(
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
    SELECT cspl_wallet_balance INTO v_current_bal
    FROM public.b2b_api_credentials
    WHERE id = p_agent_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Agent credentials not found');
    END IF;

    IF COALESCE(v_current_bal, 0) < p_amount THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Insufficient CSPL wallet balance. Available: ₹' || COALESCE(v_current_bal, 0)::TEXT || ', Required: ₹' || p_amount::TEXT,
            'current_balance', COALESCE(v_current_bal, 0)
        );
    END IF;

    UPDATE public.b2b_api_credentials
    SET cspl_wallet_balance = cspl_wallet_balance - p_amount
    WHERE id = p_agent_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'CSPL wallet debited successfully',
        'debited_amount', p_amount,
        'remaining_balance', v_current_bal - p_amount
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_b2b_cspl_wallet_balance(
    p_agent_id UUID,
    p_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.b2b_api_credentials
    SET cspl_wallet_balance = COALESCE(cspl_wallet_balance, 0) + p_amount
    WHERE id = p_agent_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'CSPL wallet refunded successfully',
        'refunded_amount', p_amount
    );
END;
$$;
