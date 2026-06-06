-- Add daily limits for Live BBPS and Normal Bill payments

-- 1. Add Daily Limit columns to qr_settings
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS daily_live_bbps_limit NUMERIC DEFAULT 500000;

ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS daily_normal_bill_limit NUMERIC DEFAULT 500000;

-- 2. Add Custom Daily Limit columns to users_profiles
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS custom_daily_live_bbps_limit NUMERIC DEFAULT 0;

ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS custom_daily_normal_bill_limit NUMERIC DEFAULT 0;

-- 3. Update submit_bill_payment_atomic function to check daily limits
CREATE OR REPLACE FUNCTION public.submit_bill_payment_atomic(
    p_user_id TEXT,
    p_customer_mobile TEXT,
    p_card_bank TEXT,
    p_card_number TEXT,
    p_card_owner_name TEXT,
    p_amount NUMERIC,
    p_charges NUMERIC
) RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_total_deduction NUMERIC;
    v_new_balance NUMERIC;
    v_bill_id UUID;
    v_limit NUMERIC;
    v_today_sum NUMERIC;
BEGIN
    -- Get daily limit (user-specific custom limit OR global limit)
    SELECT COALESCE(
        NULLIF(custom_daily_normal_bill_limit, 0),
        (SELECT daily_normal_bill_limit FROM public.qr_settings WHERE id = 1)
    ) INTO v_limit
    FROM public.users_profiles
    WHERE id = p_user_id;

    -- Calculate sum of normal bills submitted today in IST timezone
    -- Note: TIMESTAMPTZ comparison using IST date conversion
    SELECT COALESCE(SUM(amount), 0) INTO v_today_sum
    FROM public.bill_submissions
    WHERE user_id = p_user_id
      AND created_at >= (timezone('Asia/Kolkata'::text, now())::date)::timestamptz
      AND status IN ('pending', 'approved');

    IF (v_today_sum + p_amount) > v_limit THEN
        RETURN json_build_object('success', false, 'message', 'Daily normal bill limit exceeded. Remaining: ₹' || GREATEST(0, v_limit - v_today_sum));
    END IF;

    -- Calculate total deduction
    v_total_deduction := p_amount + p_charges;

    -- Lock the user's row for update to prevent race conditions
    SELECT wallet_balance INTO v_current_balance
    FROM public.users_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Check if balance is sufficient (min 250 balance rule)
    IF (v_current_balance - v_total_deduction) < 250 THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient balance. Must maintain at least ₹250.');
    END IF;

    -- Calculate new balance
    v_new_balance := v_current_balance - v_total_deduction;

    -- Update wallet
    UPDATE public.users_profiles
    SET wallet_balance = v_new_balance
    WHERE id = p_user_id;

    -- Insert bill submission
    INSERT INTO public.bill_submissions (
        user_id, customer_mobile, card_bank, card_number, card_owner_name, 
        amount, charges, status, remaining_balance
    ) VALUES (
        p_user_id, p_customer_mobile, p_card_bank, p_card_number, p_card_owner_name, 
        p_amount, p_charges, 'pending', v_new_balance
    ) RETURNING id INTO v_bill_id;

    -- Return success
    RETURN json_build_object(
        'success', true, 
        'bill_id', v_bill_id, 
        'new_balance', v_new_balance,
        'message', 'Bill payment submitted successfully!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
