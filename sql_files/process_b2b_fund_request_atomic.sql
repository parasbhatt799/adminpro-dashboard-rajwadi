-- =========================================================================
-- ATOMIC B2B FUND REQUEST APPROVAL & REVERT (PREVENTS DOUBLE CREDIT)
-- Run this in Supabase SQL Editor
-- =========================================================================

-- 1. Create Atomic RPC to process fund requests safely with row-level locks
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
BEGIN
    -- 1. Lock the fund request row FOR UPDATE to prevent race conditions
    SELECT * INTO v_req 
    FROM public.b2b_fund_requests 
    WHERE id = p_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Fund request not found');
    END IF;

    -- 2. Handle APPROVE
    IF p_action = 'approve' THEN
        -- Strictly require status to be 'pending'. If already approved, abort immediately!
        IF v_req.status != 'pending' THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'This fund request has already been processed (' || v_req.status || '). Double credit prevented!'
            );
        END IF;

        -- Lock agent credentials row and add balance atomically
        PERFORM 1 FROM public.b2b_api_credentials WHERE id = v_req.agent_id FOR UPDATE;

        UPDATE public.b2b_api_credentials 
        SET wallet_balance = COALESCE(wallet_balance, 0) + v_req.amount 
        WHERE id = v_req.agent_id;

        -- Update fund request status to approved
        UPDATE public.b2b_fund_requests 
        SET status = 'approved', updated_at = NOW() 
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Fund request approved and balance credited successfully', 
            'amount', v_req.amount,
            'agent_id', v_req.agent_id
        );

    -- 3. Handle REVERT APPROVED
    ELSIF p_action = 'revert_approved' THEN
        -- Strictly require status to be 'approved'
        IF v_req.status != 'approved' THEN
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Fund request is not in approved state (' || v_req.status || ').'
            );
        END IF;

        -- Revert balance
        PERFORM 1 FROM public.b2b_api_credentials WHERE id = v_req.agent_id FOR UPDATE;

        UPDATE public.b2b_api_credentials 
        SET wallet_balance = COALESCE(wallet_balance, 0) - v_req.amount 
        WHERE id = v_req.agent_id;

        UPDATE public.b2b_fund_requests 
        SET status = 'rejected', updated_at = NOW() 
        WHERE id = p_request_id;

        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Fund request reverted and balance deducted successfully', 
            'amount', v_req.amount,
            'agent_id', v_req.agent_id
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
