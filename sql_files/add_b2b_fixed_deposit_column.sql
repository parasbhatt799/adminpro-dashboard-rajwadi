-- Add fixed_deposit_amount to b2b_api_credentials and update deduct_b2b_wallet_balance RPC

ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS fixed_deposit_amount NUMERIC(15, 2) DEFAULT 0.00;

-- Update deduct_b2b_wallet_balance RPC to respect fixed_deposit_amount
CREATE OR REPLACE FUNCTION deduct_b2b_wallet_balance(
    p_agent_id UUID,
    p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
    current_balance NUMERIC;
    deposit_amount NUMERIC;
BEGIN
    -- Lock the row for update to prevent race conditions
    SELECT wallet_balance, COALESCE(fixed_deposit_amount, 0) 
    INTO current_balance, deposit_amount 
    FROM public.b2b_api_credentials 
    WHERE id = p_agent_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Ensure remaining balance after deduction is at least the fixed deposit amount
    IF (current_balance - p_amount) >= deposit_amount THEN
        UPDATE public.b2b_api_credentials 
        SET wallet_balance = wallet_balance - p_amount 
        WHERE id = p_agent_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
