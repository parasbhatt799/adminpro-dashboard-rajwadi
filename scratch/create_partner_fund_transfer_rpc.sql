-- Create Atomic Transfer Function for Partners (Super Distributors & Distributors)
CREATE OR REPLACE FUNCTION public.partner_transfer_funds_atomic(
    p_sender_id TEXT,
    p_receiver_id TEXT,
    p_amount NUMERIC,
    p_tpin TEXT
) RETURNS JSON AS $$
DECLARE
    v_sender_role TEXT;
    v_sender_commission NUMERIC;
    v_sender_tpin TEXT;
    v_sender_name TEXT;
    v_sender_firm TEXT;
    v_receiver_role TEXT;
    v_receiver_commission NUMERIC;
    v_receiver_wallet NUMERIC;
    v_receiver_name TEXT;
    v_receiver_firm TEXT;
    v_admin_balance NUMERIC;
    v_transfer_id UUID;
    v_remark TEXT;
    v_actual_parent TEXT;
BEGIN
    IF p_sender_id = p_receiver_id THEN
        RETURN json_build_object('success', false, 'message', 'Cannot transfer funds to yourself.');
    END IF;

    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'Please enter a valid amount greater than 0.');
    END IF;

    -- 1. Lock and retrieve Sender details
    SELECT role, commission_balance, tpin, name, firm_name 
    INTO v_sender_role, v_sender_commission, v_sender_tpin, v_sender_name, v_sender_firm
    FROM public.users_profiles
    WHERE id = p_sender_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Sender profile not found.');
    END IF;

    -- Verify Sender is either super_distributor or distributor
    IF v_sender_role NOT IN ('super_distributor', 'distributor') THEN
        RETURN json_build_object('success', false, 'message', 'Only Super Distributors and Distributors can perform this transfer.');
    END IF;

    -- Verify TPIN
    IF v_sender_tpin IS NULL OR v_sender_tpin = '' THEN
        RETURN json_build_object('success', false, 'message', 'Please set your TPIN first under Profile > TPIN.');
    END IF;

    IF v_sender_tpin != p_tpin THEN
        RETURN json_build_object('success', false, 'message', 'Incorrect TPIN. Please try again.');
    END IF;

    -- Check Sender Commission Balance
    IF v_sender_commission < p_amount THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance in Commission Wallet.');
    END IF;

    -- 2. Lock and retrieve Receiver details
    SELECT role, commission_balance, wallet_balance, name, firm_name
    INTO v_receiver_role, v_receiver_commission, v_receiver_wallet, v_receiver_name, v_receiver_firm
    FROM public.users_profiles
    WHERE id = p_receiver_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Receiver user not found.');
    END IF;

    -- 3. Relationship Checks & Balance Logic
    IF v_sender_role = 'super_distributor' THEN
        -- Receiver must be a distributor
        IF v_receiver_role != 'distributor' THEN
            RETURN json_build_object('success', false, 'message', 'Super Distributors can only transfer funds to Distributors.');
        END IF;

        -- Receiver's super_distributor_id must match Sender's ID
        SELECT super_distributor_id INTO v_actual_parent FROM public.users_profiles WHERE id = p_receiver_id;
        IF v_actual_parent IS NULL OR v_actual_parent != p_sender_id THEN
            RETURN json_build_object('success', false, 'message', 'This Distributor is not managed by you.');
        END IF;

        -- Update Sender balance (Deduct commission_balance)
        UPDATE public.users_profiles
        SET commission_balance = v_sender_commission - p_amount
        WHERE id = p_sender_id;

        -- Update Receiver balance (Add commission_balance)
        UPDATE public.users_profiles
        SET commission_balance = v_receiver_commission + p_amount
        WHERE id = p_receiver_id;

        -- Set history remark
        v_remark := 'Fund Transfer: Super Dist. ' || COALESCE(v_sender_firm, v_sender_name) || ' -> Dist. ' || COALESCE(v_receiver_firm, v_receiver_name);

        -- Insert transfer history record in fund_transfers
        INSERT INTO public.fund_transfers (
            sender_id, receiver_id, amount, remarks
        ) VALUES (
            p_sender_id, p_receiver_id, p_amount, v_remark
        ) RETURNING id INTO v_transfer_id;

        RETURN json_build_object(
            'success', true,
            'transfer_id', v_transfer_id,
            'new_balance', v_sender_commission - p_amount,
            'message', 'Funds transferred successfully!'
        );

    ELSIF v_sender_role = 'distributor' THEN
        -- Receiver must be a user
        IF v_receiver_role != 'user' THEN
            RETURN json_build_object('success', false, 'message', 'Distributors can only transfer funds to Users.');
        END IF;

        -- Receiver's distributor_id must match Sender's ID
        SELECT distributor_id INTO v_actual_parent FROM public.users_profiles WHERE id = p_receiver_id;
        IF v_actual_parent IS NULL OR v_actual_parent != p_sender_id THEN
            RETURN json_build_object('success', false, 'message', 'This User is not managed by you.');
        END IF;

        -- Update Sender balance (Deduct commission_balance)
        UPDATE public.users_profiles
        SET commission_balance = v_sender_commission - p_amount
        WHERE id = p_sender_id;

        -- Update Receiver balance (Add wallet_balance)
        UPDATE public.users_profiles
        SET wallet_balance = v_receiver_wallet + p_amount
        WHERE id = p_receiver_id;

        -- Deduct from Admin's wallet balance in qr_settings
        SELECT admin_balance INTO v_admin_balance FROM public.qr_settings WHERE id = 1 FOR UPDATE;
        UPDATE public.qr_settings
        SET admin_balance = COALESCE(v_admin_balance, 0) - p_amount
        WHERE id = 1;

        -- Write entry into admin_withdrawals table
        INSERT INTO public.admin_withdrawals (amount, remark)
        VALUES (p_amount, 'Dist. ' || COALESCE(v_sender_firm, v_sender_name) || ' transferred to User ' || COALESCE(v_receiver_firm, v_receiver_name));

        -- Set history remark
        v_remark := 'Fund Transfer: Dist. ' || COALESCE(v_sender_firm, v_sender_name) || ' -> User ' || COALESCE(v_receiver_firm, v_receiver_name);

        -- Insert transfer history record in fund_transfers
        INSERT INTO public.fund_transfers (
            sender_id, receiver_id, amount, remarks
        ) VALUES (
            p_sender_id, p_receiver_id, p_amount, v_remark
        ) RETURNING id INTO v_transfer_id;

        RETURN json_build_object(
            'success', true,
            'transfer_id', v_transfer_id,
            'new_balance', v_sender_commission - p_amount,
            'message', 'Funds transferred successfully!'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema
NOTIFY pgrst, 'reload schema';
