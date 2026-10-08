-- =========================================================================
-- B2B BBPS BILL PAYMENT ATOMIC REFUND GUARD & DOUBLE REFUND PREVENTION
-- Prevents race conditions and double refunds across:
-- 1. Gateway API failures (payBill catch & FAILED responses)
-- 2. Status polling & checkBillStatus
-- 3. Background cron reconciliation jobs (billavenue-cron & sync_all_pending_bills)
-- 4. Manual admin status updates (admin_update_b2b_bill_status)
-- =========================================================================

-- 1. Atomic RPC to execute BBPS Bill Refund with Row-Level Lock
CREATE OR REPLACE FUNCTION public.refund_b2b_bill_atomic(
    p_log_id UUID,
    p_reason TEXT DEFAULT 'Bill payment failed at gateway'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log RECORD;
    v_total_deduction NUMERIC;
    v_agent_id UUID;
    v_res JSONB;
BEGIN
    -- 1. Lock log row FOR UPDATE
    SELECT * INTO v_log
    FROM public.b2b_api_logs
    WHERE id = p_log_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bill log not found');
    END IF;

    -- 2. Extract totalDeduction (fallback to amount)
    v_total_deduction := COALESCE(
        (v_log.request_payload->>'totalDeduction')::NUMERIC,
        (v_log.request_payload->>'amount')::NUMERIC,
        0
    );

    IF v_total_deduction <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid deduction amount');
    END IF;

    v_agent_id := v_log.agent_id::UUID;

    -- 3. Strict Check: If already marked failed or already refunded, BLOCK duplicate refund!
    IF v_log.payment_status = 'failed' 
       OR COALESCE(v_log.response_payload->>'payment_status', '') = 'failed'
       OR COALESCE((v_log.response_payload->>'is_refunded')::BOOLEAN, false) = true 
       OR COALESCE((v_log.response_payload->>'refunded')::BOOLEAN, false) = true THEN
        RETURN jsonb_build_object(
            'success', false,
            'already_refunded', true,
            'current_status', v_log.payment_status,
            'message', 'Bill is already refunded or marked failed. Double refund prevented!'
        );
    END IF;

    -- 4. Lock agent credentials row & credit wallet
    PERFORM 1 
    FROM public.b2b_api_credentials 
    WHERE id = v_agent_id 
    FOR UPDATE;

    UPDATE public.b2b_api_credentials
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_total_deduction
    WHERE id = v_agent_id;

    -- 5. Mark log as failed, refunded, and clear charge atomically
    v_res := COALESCE(v_log.response_payload, '{}'::jsonb);
    v_res := jsonb_set(v_res, '{payment_status}', '"failed"');
    v_res := jsonb_set(v_res, '{finalStatus}', '"failed"');
    v_res := jsonb_set(v_res, '{refunded}', 'true'::jsonb);
    v_res := jsonb_set(v_res, '{is_refunded}', 'true'::jsonb);
    v_res := jsonb_set(v_res, '{refunded_amount}', to_jsonb(v_total_deduction));
    v_res := jsonb_set(v_res, '{refunded_at}', to_jsonb(NOW()::text));
    v_res := jsonb_set(v_res, '{failureReason}', to_jsonb(p_reason));

    UPDATE public.b2b_api_logs
    SET 
        payment_status = 'failed',
        status_code = 500,
        charge_deducted = 0,
        response_payload = v_res
    WHERE id = v_log.id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Refund processed successfully',
        'log_id', p_log_id,
        'refund_amount', v_total_deduction,
        'agent_id', v_agent_id
    );
END;
$$;


-- 2. Update admin_update_b2b_bill_status with strict double-refund guards
CREATE OR REPLACE FUNCTION public.admin_update_b2b_bill_status(
  p_log_id UUID,
  p_status TEXT -- 'success' or 'failed'
)
RETURNS JSON AS $$
DECLARE
  v_log RECORD;
  v_current_status TEXT;
  v_total_deduction NUMERIC;
  v_charge_deducted NUMERIC;
  v_agent_id UUID;
  v_res JSONB;
BEGIN
  -- Fetch the log and lock it
  SELECT * INTO v_log FROM b2b_api_logs WHERE id = p_log_id FOR UPDATE;
  
  IF v_log IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Log not found');
  END IF;

  v_current_status := COALESCE(v_log.response_payload->>'payment_status', v_log.payment_status);
  v_agent_id := v_log.agent_id::UUID;
  
  -- Extract totalDeduction or amount from request_payload
  v_total_deduction := (v_log.request_payload->>'totalDeduction')::NUMERIC;
  IF v_total_deduction IS NULL THEN
    v_total_deduction := (v_log.request_payload->>'amount')::NUMERIC;
  END IF;

  -- Extract charge_deducted (API charge / Admin Profit)
  v_charge_deducted := (v_log.request_payload->>'chargeDeducted')::NUMERIC;
  IF v_charge_deducted IS NULL THEN
    v_charge_deducted := 0;
  END IF;

  -- Ensure we have an amount if we need to refund
  IF v_total_deduction IS NULL OR v_total_deduction <= 0 THEN
    v_total_deduction := (v_log.response_payload->>'billAmount')::NUMERIC;
    IF v_total_deduction IS NULL OR v_total_deduction <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'Could not determine the amount to process.');
    END IF;
  END IF;

  IF v_current_status = p_status THEN
    RETURN json_build_object('success', false, 'message', 'Status is already ' || p_status);
  END IF;

  -- Wallet & Profit Logic with Double Refund Protection
  IF p_status = 'failed' THEN
    -- Check if already refunded to prevent duplicate wallet credits
    IF COALESCE((v_log.response_payload->>'refunded')::BOOLEAN, false) = true
       OR COALESCE((v_log.response_payload->>'is_refunded')::BOOLEAN, false) = true
       OR v_log.payment_status = 'failed' THEN
        -- Already refunded! Do NOT credit wallet again!
        IF v_current_status = 'success' AND v_charge_deducted > 0 THEN
            PERFORM add_admin_balance(-v_charge_deducted);
        END IF;
    ELSE
        -- Not yet refunded, credit agent wallet once
        PERFORM add_b2b_wallet_balance(v_agent_id, v_total_deduction);
        IF v_current_status = 'success' AND v_charge_deducted > 0 THEN
            PERFORM add_admin_balance(-v_charge_deducted);
        END IF;
    END IF;

  ELSIF p_status = 'success' THEN
    IF v_current_status = 'failed' THEN
        -- It was failed (and refunded previously). Now changing back to success. Deduct total deduction from wallet.
        UPDATE public.b2b_api_credentials 
        SET wallet_balance = wallet_balance - v_total_deduction 
        WHERE id = v_agent_id;
        
        -- Add admin profit
        IF v_charge_deducted > 0 THEN
            PERFORM add_admin_balance(v_charge_deducted);
        END IF;
    ELSIF v_current_status = 'pending' OR v_current_status IS NULL THEN
        -- If it was pending, money was already deducted from agent, so do nothing to agent wallet.
        -- Credit the admin profit now.
        IF v_charge_deducted > 0 THEN
            PERFORM add_admin_balance(v_charge_deducted);
        END IF;
    END IF;
  END IF;

  -- Update response payload
  v_res := COALESCE(v_log.response_payload, '{}'::jsonb);
  v_res := jsonb_set(v_res, '{payment_status}', to_jsonb(p_status));
  v_res := jsonb_set(v_res, '{finalStatus}', to_jsonb(p_status));
  v_res := jsonb_set(v_res, '{admin_updated}', to_jsonb(true));
  v_res := jsonb_set(v_res, '{admin_updated_at}', to_jsonb(now()));

  IF p_status = 'failed' THEN
      v_res := jsonb_set(v_res, '{refunded}', 'true'::jsonb);
      v_res := jsonb_set(v_res, '{is_refunded}', 'true'::jsonb);
      v_res := jsonb_set(v_res, '{refunded_amount}', to_jsonb(v_total_deduction));
      v_res := jsonb_set(v_res, '{refunded_at}', to_jsonb(now()));
  END IF;

  -- Update b2b_api_logs
  IF p_status = 'success' THEN
      UPDATE b2b_api_logs 
      SET response_payload = v_res, 
          status_code = 200, 
          charge_deducted = v_charge_deducted
      WHERE id = p_log_id;
  ELSE
      UPDATE b2b_api_logs 
      SET response_payload = v_res, 
          status_code = 500, 
          charge_deducted = 0
      WHERE id = p_log_id;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Status updated to ' || p_status || ' successfully. ' || CASE WHEN p_status = 'failed' THEN 'Wallet refund processed safely.' ELSE '' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
