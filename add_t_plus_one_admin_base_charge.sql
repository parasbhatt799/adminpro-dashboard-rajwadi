-- ==========================================================
-- ADD T+1 ADMIN BASE CHARGE COLUMN & UPDATE APPROVE RPC
-- Adds admin_base_t_plus_one_charge column to users_profiles
-- and updates approve_qr_payment to use dedicated T+1 base charges.
-- ==========================================================

-- 1. Add admin_base_t_plus_one_charge column
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS admin_base_t_plus_one_charge NUMERIC DEFAULT 0;

-- 2. Update approve_qr_payment function
CREATE OR REPLACE FUNCTION public.approve_qr_payment(p_payment_id UUID, p_admin_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_user RECORD;
    v_distributor RECORD;
    v_super_distributor RECORD;
    v_qr_settings RECORD;
    
    v_total_charges NUMERIC;
    v_admin_share NUMERIC;
    v_distributor_profit NUMERIC;
    v_super_distributor_profit NUMERIC;
    
    v_user_percentage NUMERIC;
    v_distributor_base_percentage NUMERIC;
    v_super_distributor_base_percentage NUMERIC;
    v_super_distributor_id TEXT;
BEGIN
    -- 1. Lock the payment request and check status
    SELECT * INTO v_payment 
    FROM public.payment_submissions 
    WHERE id = p_payment_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Payment request not found');
    END IF;

    IF v_payment.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'This request has already been processed (' || v_payment.status || ')');
    END IF;

    -- 2. Lock the user profile
    SELECT * INTO v_user 
    FROM public.users_profiles 
    WHERE id = v_payment.user_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
    END IF;

    -- 3. Calculate charges based on user profile and T+1 flag
    IF v_payment.t_plus_one THEN
        v_user_percentage := COALESCE(v_user.t_plus_one_charge, 0);
    ELSE
        v_user_percentage := COALESCE(v_user.charge_percentage, 0);
    END IF;
    v_total_charges := (v_payment.amount * v_user_percentage) / 100;
    
    v_admin_share := v_total_charges;
    v_distributor_profit := 0;
    v_super_distributor_profit := 0;
    v_super_distributor_id := NULL;

    -- 4. Logic for Multi-level Profit Sharing (for both normal and T+1 payments)
    IF v_user.distributor_id IS NOT NULL THEN
        -- Lock the distributor profile
        SELECT * INTO v_distributor 
        FROM public.users_profiles 
        WHERE id = v_user.distributor_id FOR UPDATE;

        IF FOUND THEN
            -- Select appropriate base charges depending on whether this is T+1 or Normal QR
            IF v_payment.t_plus_one THEN
                v_distributor_base_percentage := COALESCE(v_distributor.admin_base_t_plus_one_charge, v_distributor.admin_base_qr_charge, 0);
            ELSE
                v_distributor_base_percentage := COALESCE(v_distributor.admin_base_qr_charge, 0);
            END IF;
            
            -- Check if distributor has a super distributor parent
            IF v_distributor.super_distributor_id IS NOT NULL THEN
                -- Lock the super distributor profile
                SELECT * INTO v_super_distributor 
                FROM public.users_profiles 
                WHERE id = v_distributor.super_distributor_id FOR UPDATE;
                
                IF FOUND AND v_super_distributor.role = 'super_distributor' THEN
                    v_super_distributor_id := v_super_distributor.id;
                    
                    IF v_payment.t_plus_one THEN
                        v_super_distributor_base_percentage := COALESCE(v_super_distributor.admin_base_t_plus_one_charge, v_super_distributor.admin_base_qr_charge, 0);
                    ELSE
                        v_super_distributor_base_percentage := COALESCE(v_super_distributor.admin_base_qr_charge, 0);
                    END IF;
                    
                    -- Splits calculations:
                    -- Admin gets the base charge set on Super Distributor
                    v_admin_share := (v_payment.amount * v_super_distributor_base_percentage) / 100;
                    
                    -- Super Distributor gets the difference between Distributor's base charge and their own base charge
                    v_super_distributor_profit := (v_payment.amount * (v_distributor_base_percentage - v_super_distributor_base_percentage)) / 100;
                    
                    -- Distributor gets the difference between User's charge and their own base charge
                    v_distributor_profit := v_total_charges - ((v_payment.amount * v_distributor_base_percentage) / 100);
                ELSE
                    -- fallback if super distributor not found or incorrect role
                    v_admin_share := (v_payment.amount * v_distributor_base_percentage) / 100;
                    v_distributor_profit := v_total_charges - v_admin_share;
                END IF;
            ELSE
                -- Normal distributor-user path (Admin -> Distributor -> User)
                v_admin_share := (v_payment.amount * v_distributor_base_percentage) / 100;
                v_distributor_profit := v_total_charges - v_admin_share;
            END IF;
        END IF;
    END IF;

    -- Ensure negative commission values aren't created due to incorrect configurations
    v_admin_share := GREATEST(0, v_admin_share);
    v_distributor_profit := GREATEST(0, v_distributor_profit);
    v_super_distributor_profit := GREATEST(0, v_super_distributor_profit);

    -- 5. Lock and update QR settings (Admin Balance)
    SELECT * INTO v_qr_settings FROM public.qr_settings WHERE id = 1 FOR UPDATE;
    UPDATE public.qr_settings 
    SET admin_balance = COALESCE(admin_balance, 0) + v_admin_share 
    WHERE id = 1;

    -- 6. Update User Wallet (wallet_balance if normal, t_plus_one_balance if T+1)
    IF v_payment.t_plus_one THEN
        UPDATE public.users_profiles 
        SET t_plus_one_balance = COALESCE(t_plus_one_balance, 0) + (v_payment.amount - v_total_charges) 
        WHERE id = v_payment.user_id;
    ELSE
        UPDATE public.users_profiles 
        SET wallet_balance = COALESCE(wallet_balance, 0) + (v_payment.amount - v_total_charges) 
        WHERE id = v_payment.user_id;
    END IF;

    -- 7. Update Distributor Wallet if applicable (Commission Wallet) - For BOTH normal and T+1
    IF v_distributor_profit > 0 AND v_user.distributor_id IS NOT NULL THEN
        UPDATE public.users_profiles 
        SET commission_balance = COALESCE(commission_balance, 0) + v_distributor_profit 
        WHERE id = v_user.distributor_id;

        -- Notify Distributor
        INSERT INTO public.notifications (user_id, target_role, title, message, link)
        VALUES (
            v_user.distributor_id, 
            'user', 
            'Profit Earned!', 
            'You earned ₹' || ROUND(v_distributor_profit, 2)::TEXT || ' profit from a sub-user''s ' || CASE WHEN v_payment.t_plus_one THEN 'T+1 ' ELSE '' END || 'QR payment.', 
            '/user/statement'
        );
    END IF;

    -- 7b. Update Super Distributor Wallet if applicable (Commission Wallet) - For BOTH normal and T+1
    IF v_super_distributor_profit > 0 AND v_super_distributor_id IS NOT NULL THEN
        UPDATE public.users_profiles 
        SET commission_balance = COALESCE(commission_balance, 0) + v_super_distributor_profit 
        WHERE id = v_super_distributor_id;

        -- Notify Super Distributor
        INSERT INTO public.notifications (user_id, target_role, title, message, link)
        VALUES (
            v_super_distributor_id, 
            'user', 
            'Super Profit Earned!', 
            'You earned ₹' || ROUND(v_super_distributor_profit, 2)::TEXT || ' super profit from a sub-distributor''s ' || CASE WHEN v_payment.t_plus_one THEN 'T+1 ' ELSE '' END || 'QR payment.', 
            '/user/statement'
        );
    END IF;

    -- 8. Update Payment Submission status and store calculated shares
    UPDATE public.payment_submissions 
    SET 
        status = CASE WHEN v_payment.t_plus_one THEN 'T+1 Approved' ELSE 'approved' END,
        charges = v_total_charges,
        admin_share = v_admin_share,
        distributor_share = v_distributor_profit,
        super_distributor_share = v_super_distributor_profit,
        super_distributor_id = v_super_distributor_id,
        actioned_by = p_admin_id,
        actioned_at = NOW()
    WHERE id = p_payment_id;

    -- 9. Notify User
    INSERT INTO public.notifications (user_id, target_role, title, message, link)
    VALUES (
        v_payment.user_id, 
        'user', 
        CASE WHEN v_payment.t_plus_one THEN 'QR Payment T+1 Approved' ELSE 'QR Payment Approved' END, 
        CASE WHEN v_payment.t_plus_one THEN 'Your QR payment of ₹' || v_payment.amount::TEXT || ' has been approved for T+1 settlement! Balance will credit tomorrow at 11:00 AM.' ELSE 'Your QR payment of ₹' || v_payment.amount::TEXT || ' has been approved!' END, 
        '/user/payment'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', CASE WHEN v_payment.t_plus_one THEN 'Payment approved for T+1 settlement successfully' ELSE 'Payment approved successfully' END,
        'data', jsonb_build_object(
            'amount', v_payment.amount,
            'credited_amount', v_payment.amount - v_total_charges,
            'total_charges', v_total_charges,
            'admin_share', v_admin_share,
            'distributor_share', v_distributor_profit,
            'super_distributor_share', v_super_distributor_profit,
            'user_id', v_payment.user_id,
            't_plus_one', v_payment.t_plus_one
        )
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transaction failed: ' || SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
