-- =========================================================================
-- B2B PAYOUT ATOMIC REFUND GUARD & DOUBLE REFUND PREVENTION
-- Run this script in the Supabase SQL Editor
-- =========================================================================

-- 1. Add is_refunded and refunded_at tracking columns to b2b_payout_transactions
ALTER TABLE public.b2b_payout_transactions 
ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT false;

ALTER TABLE public.b2b_payout_transactions 
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- 2. Backfill existing failed payout transactions
UPDATE public.b2b_payout_transactions 
SET is_refunded = true, 
    refunded_at = COALESCE(updated_at, created_at)
WHERE status = 'failed' AND (is_refunded IS NULL OR is_refunded = false);

-- 3. Create Atomic RPC to execute Payout Refund with Row-Level Lock
-- Ensures that concurrent requests (API failure, Webhook callback, Cron reconciliation)
-- can NEVER double-refund a transaction.
CREATE OR REPLACE FUNCTION public.refund_b2b_payout_atomic(
    p_order_id TEXT,
    p_reason TEXT DEFAULT 'Bank transaction declined'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tx RECORD;
BEGIN
    -- 1. Lock transaction row FOR UPDATE
    SELECT * INTO v_tx
    FROM public.b2b_payout_transactions
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Payout transaction not found');
    END IF;

    -- 2. Strict Check: If already refunded or not pending, block duplicate refund!
    IF COALESCE(v_tx.is_refunded, false) = true OR v_tx.status != 'pending' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'already_processed', true,
            'current_status', v_tx.status,
            'is_refunded', COALESCE(v_tx.is_refunded, false),
            'message', 'Transaction has already been processed or refunded. Double refund prevented!'
        );
    END IF;

    -- 3. Lock agent credentials row & credit wallet
    PERFORM 1 
    FROM public.b2b_api_credentials 
    WHERE id = v_tx.agent_id 
    FOR UPDATE;

    UPDATE public.b2b_api_credentials
    SET payout_wallet_balance = COALESCE(payout_wallet_balance, 0) + v_tx.total_deducted
    WHERE id = v_tx.agent_id;

    -- 4. Mark transaction as refunded and failed atomically
    UPDATE public.b2b_payout_transactions
    SET 
        status = 'failed',
        is_refunded = true,
        refunded_at = NOW(),
        error_message = COALESCE(p_reason, error_message, 'Bank transaction declined'),
        updated_at = NOW()
    WHERE id = v_tx.id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Refund processed successfully',
        'order_id', p_order_id,
        'refund_amount', v_tx.total_deducted,
        'agent_id', v_tx.agent_id
    );
END;
$$;
