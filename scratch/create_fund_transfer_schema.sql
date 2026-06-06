-- Create Table
CREATE TABLE IF NOT EXISTS public.fund_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.fund_transfers ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "fund_transfers_select" ON public.fund_transfers;
CREATE POLICY "fund_transfers_select" ON public.fund_transfers
FOR SELECT USING (sender_id = auth.uid()::text OR receiver_id = auth.uid()::text);

DROP POLICY IF EXISTS "fund_transfers_all" ON public.fund_transfers;
CREATE POLICY "fund_transfers_all" ON public.fund_transfers
FOR ALL USING (true) WITH CHECK (true);

-- Atomic Transfer Function
CREATE OR REPLACE FUNCTION transfer_funds_atomic(
    p_sender_id TEXT,
    p_receiver_id TEXT,
    p_amount NUMERIC,
    p_tpin TEXT
) RETURNS JSON AS $$
DECLARE
    v_sender_balance NUMERIC;
    v_receiver_balance NUMERIC;
    v_sender_tpin TEXT;
    v_sender_name TEXT;
    v_receiver_name TEXT;
    v_transfer_id UUID;
BEGIN
    IF p_sender_id = p_receiver_id THEN
        RETURN json_build_object('success', false, 'message', 'Cannot transfer funds to yourself.');
    END IF;

    -- Lock Sender Row
    SELECT wallet_balance, tpin, name INTO v_sender_balance, v_sender_tpin, v_sender_name
    FROM public.users_profiles
    WHERE id = p_sender_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Sender profile not found.');
    END IF;

    -- Verify TPIN
    IF v_sender_tpin IS NULL OR v_sender_tpin = '' THEN
        RETURN json_build_object('success', false, 'message', 'Please set your TPIN first under Profile > TPIN.');
    END IF;

    IF v_sender_tpin != p_tpin THEN
        RETURN json_build_object('success', false, 'message', 'Incorrect TPIN. Please try again.');
    END IF;

    -- Verify Sender Balance (Minimum 250 retain limit)
    IF (v_sender_balance - p_amount) < 250 THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. You must retain at least ₹250 in your wallet after transfer.');
    END IF;

    -- Lock Receiver Row
    SELECT wallet_balance, name INTO v_receiver_balance, v_receiver_name
    FROM public.users_profiles
    WHERE id = p_receiver_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Receiver user not found. Please check the User ID.');
    END IF;

    -- Update balances
    UPDATE public.users_profiles
    SET wallet_balance = v_sender_balance - p_amount
    WHERE id = p_sender_id;

    UPDATE public.users_profiles
    SET wallet_balance = v_receiver_balance + p_amount
    WHERE id = p_receiver_id;

    -- Insert transfer history record
    INSERT INTO public.fund_transfers (
        sender_id, receiver_id, amount, remarks
    ) VALUES (
        p_sender_id, p_receiver_id, p_amount, 'Transfer from ' || v_sender_name || ' to ' || v_receiver_name
    ) RETURNING id INTO v_transfer_id;

    RETURN json_build_object(
        'success', true,
        'transfer_id', v_transfer_id,
        'new_balance', v_sender_balance - p_amount,
        'message', 'Funds transferred successfully!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add independent toggle for Fund Transfer in qr_settings
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS is_fund_transfer_enabled BOOLEAN DEFAULT TRUE;

-- Reload Schema
NOTIFY pgrst, 'reload schema';

