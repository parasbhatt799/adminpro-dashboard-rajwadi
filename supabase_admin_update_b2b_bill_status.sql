CREATE OR REPLACE FUNCTION admin_update_b2b_bill_status(
  p_log_id UUID,
  p_status TEXT -- 'success' or 'failed'
)
RETURNS JSON AS $$
DECLARE
  v_log RECORD;
  v_current_status TEXT;
  v_total_deduction NUMERIC;
  v_agent_id UUID;
  v_res JSONB;
BEGIN
  -- Fetch the log and lock it
  SELECT * INTO v_log FROM b2b_api_logs WHERE id = p_log_id FOR UPDATE;
  
  IF v_log IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Log not found');
  END IF;

  v_current_status := v_log.response_payload->>'payment_status';
  v_agent_id := v_log.agent_id::UUID;
  
  -- Extract totalDeduction or amount from request_payload
  v_total_deduction := (v_log.request_payload->>'totalDeduction')::NUMERIC;
  IF v_total_deduction IS NULL THEN
    v_total_deduction := (v_log.request_payload->>'amount')::NUMERIC;
  END IF;

  -- Ensure we have an amount if we need to refund
  IF v_total_deduction IS NULL OR v_total_deduction <= 0 THEN
    -- Try to fallback to response_payload billAmount if missing
    v_total_deduction := (v_log.response_payload->>'billAmount')::NUMERIC;
    IF v_total_deduction IS NULL OR v_total_deduction <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'Could not determine the amount to process.');
    END IF;
  END IF;

  IF v_current_status = p_status THEN
    RETURN json_build_object('success', false, 'message', 'Status is already ' || p_status);
  END IF;

  -- Wallet Logic
  IF p_status = 'failed' THEN
    IF v_current_status = 'success' THEN
        -- It was success, now changing to failed. Need to refund.
        PERFORM add_b2b_wallet_balance(v_agent_id, v_total_deduction);
    ELSIF v_current_status = 'pending' OR v_current_status IS NULL THEN
        -- It was pending (money was already deducted when placed), need to refund.
        PERFORM add_b2b_wallet_balance(v_agent_id, v_total_deduction);
    END IF;
  ELSIF p_status = 'success' THEN
    IF v_current_status = 'failed' THEN
        -- It was failed (and refunded previously). Now changing back to success. Need to deduct again.
        PERFORM deduct_b2b_wallet_balance(v_agent_id, v_total_deduction);
    END IF;
    -- If it was pending, money was already deducted, so do nothing to wallet.
  END IF;

  -- Update the response payload to reflect the new status
  v_res := COALESCE(v_log.response_payload, '{}'::jsonb);
  v_res := jsonb_set(v_res, '{payment_status}', to_jsonb(p_status));
  v_res := jsonb_set(v_res, '{finalStatus}', to_jsonb(p_status));
  
  -- Optionally add an admin_updated flag
  v_res := jsonb_set(v_res, '{admin_updated}', to_jsonb(true));
  v_res := jsonb_set(v_res, '{admin_updated_at}', to_jsonb(now()));

  UPDATE b2b_api_logs 
  SET response_payload = v_res
  WHERE id = p_log_id;

  RETURN json_build_object('success', true, 'message', 'Status updated to ' || p_status || ' successfully. ' || CASE WHEN p_status = 'failed' THEN 'Wallet refunded.' ELSE '' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
