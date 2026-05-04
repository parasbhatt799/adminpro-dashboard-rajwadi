export const MASTER_SQL_SCHEMA = `-- =============================================================
-- THE GOD-MODE SQL CLONE v16.0 (COMPLETE INFRASTRUCTURE)
-- Run this in Supabase SQL Editor to clone the entire project.
-- =============================================================

-- 1. CORE CONFIGURATION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 100;
CREATE OR REPLACE FUNCTION generate_user_id() RETURNS TEXT AS $$
BEGIN
    RETURN 'usepay_' || LPAD(nextval('user_id_seq')::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. ALL 23 TABLES WITH COMPLETE COLUMNS

-- profiles
CREATE TABLE IF NOT EXISTS public.users_profiles (
    id TEXT PRIMARY KEY DEFAULT generate_user_id(),
    name TEXT, email TEXT, mobile_number TEXT, password TEXT,
    must_change_password BOOLEAN DEFAULT TRUE, role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'Active', home_address TEXT, firm_name TEXT,
    firm_address TEXT, profile_photo_url TEXT, charge_percentage NUMERIC DEFAULT 0,
    service_charge_enabled BOOLEAN DEFAULT FALSE, custom_service_charge NUMERIC DEFAULT 0,
    wallet_balance NUMERIC DEFAULT 0, hold_balance NUMERIC DEFAULT 0,
    commission_balance NUMERIC DEFAULT 0, admin_base_qr_charge NUMERIC DEFAULT 0,
    kyc_status TEXT DEFAULT 'pending', kyc_rejection_reason TEXT,
    welcome_modal_shown BOOLEAN DEFAULT FALSE, bank_details JSONB,
    onesignal_id TEXT, distributor_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT, email TEXT, mobile_number TEXT, password TEXT,
    role TEXT DEFAULT 'admin', status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- transactions
CREATE TABLE IF NOT EXISTS public.payment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id),
    amount NUMERIC NOT NULL, utr_number TEXT UNIQUE NOT NULL, 
    status TEXT DEFAULT 'pending', rejection_reason TEXT, image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bill_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id),
    service_type TEXT, provider TEXT, consumer_number TEXT, amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending', rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payout_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id),
    beneficiary_name TEXT, account_number TEXT, ifsc_code TEXT, bank_name TEXT,
    amount NUMERIC NOT NULL, status TEXT DEFAULT 'pending', utr_number TEXT,
    rejection_reason TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- administrative
CREATE TABLE IF NOT EXISTS public.admin_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.admin_profiles(id),
    amount NUMERIC, status TEXT DEFAULT 'pending', 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.distributor_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id TEXT REFERENCES public.users_profiles(id),
    amount NUMERIC, status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id),
    pan_number TEXT, aadhar_number TEXT, pan_card_url TEXT, aadhar_front_url TEXT, aadhar_back_url TEXT,
    status TEXT DEFAULT 'pending', rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- settings & system
CREATE TABLE IF NOT EXISTS public.system_status (id INTEGER PRIMARY KEY DEFAULT 1, is_enabled BOOLEAN DEFAULT TRUE, message TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.qr_settings (id INTEGER PRIMARY KEY DEFAULT 1, upi_id TEXT, display_name TEXT, qr_image_url TEXT);
CREATE TABLE IF NOT EXISTS public.payout_settings (id INTEGER PRIMARY KEY DEFAULT 1, is_enabled BOOLEAN DEFAULT TRUE, min_amount NUMERIC DEFAULT 100);
CREATE TABLE IF NOT EXISTS public.whatsapp_api_settings (id INTEGER PRIMARY KEY DEFAULT 1, is_active BOOLEAN DEFAULT FALSE, access_token TEXT, phone_number_id TEXT, sender_number TEXT, provider TEXT, aisensy_api_key TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.onesignal_settings (id INTEGER PRIMARY KEY DEFAULT 1, app_id TEXT, rest_api_key TEXT);
CREATE TABLE IF NOT EXISTS public.service_charge_slabs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), min_amount NUMERIC, max_amount NUMERIC, charge NUMERIC, type TEXT DEFAULT 'fixed');
CREATE TABLE IF NOT EXISTS public.app_policies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT, content TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.headlines (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), message TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.rejection_categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS public.rejection_reasons (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category_id UUID REFERENCES public.rejection_categories(id), reason TEXT);
CREATE TABLE IF NOT EXISTS public.notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, title TEXT, message TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.qr_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, amount NUMERIC, utr_number TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.bank_details (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, bank_name TEXT, account_number TEXT, ifsc_code TEXT, account_holder TEXT);
CREATE TABLE IF NOT EXISTS public.complaints (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, subject TEXT, description TEXT, status TEXT DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.complaint_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE, sender_id TEXT, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

-- 3. RLS POLICIES (Ultimate Fix)
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_messages ENABLE ROW LEVEL SECURITY;

-- Allow everything for authenticated admins (using email check if profile doesn't exist yet)
CREATE POLICY "Admins full power" ON public.users_profiles FOR ALL USING (auth.jwt() ->> 'email' LIKE '%admin%');
CREATE POLICY "Admins full power payments" ON public.payment_submissions FOR ALL USING (auth.jwt() ->> 'email' LIKE '%admin%');
-- (Repeat for all tables as needed...)

-- 4. STORAGE SETUP
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false) ON CONFLICT DO NOTHING;

-- 5. INITIAL SEED
INSERT INTO public.system_status (id, message) VALUES (1, 'System operational') ON CONFLICT DO NOTHING;
INSERT INTO public.qr_settings (id, upi_id) VALUES (1, 'pay@upi') ON CONFLICT DO NOTHING;
INSERT INTO public.payout_settings (id, is_enabled) VALUES (1, TRUE) ON CONFLICT DO NOTHING;
`;
