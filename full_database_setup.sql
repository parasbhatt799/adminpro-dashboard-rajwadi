-- ==========================================
-- MASTER DATABASE SETUP FOR RAJWADI / USEPAY
-- ==========================================
-- This script resets and sets up the entire database with:
-- 1. Custom User ID format (usepay_001)
-- 2. All project tables and RLS policies
-- 3. Storage buckets and Realtime configuration

-- WARNING: This will DELETE all existing data!

-- 0. CLEANUP (Optional: Remove if you don't want to reset everything)
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- GRANT ALL ON SCHEMA public TO postgres;
-- GRANT ALL ON SCHEMA public TO public;

-- 1. CUSTOM ID GENERATOR SETUP
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 1;

CREATE OR REPLACE FUNCTION generate_user_id() RETURNS TEXT AS $$
BEGIN
    RETURN 'usepay_' || LPAD(nextval('user_id_seq')::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. CORE TABLES
-- Admin Profiles
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mobile_number text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.admin_profiles (mobile_number, password)
VALUES ('8140428671', 'admin123')
ON CONFLICT (mobile_number) DO NOTHING;

-- User Profiles (Primary Table)
CREATE TABLE IF NOT EXISTS public.users_profiles (
    id TEXT PRIMARY KEY DEFAULT generate_user_id(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mobile_number TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    must_change_password BOOLEAN DEFAULT TRUE,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'Active',
    home_address TEXT,
    firm_name TEXT,
    firm_address TEXT,
    profile_photo_url TEXT,
    charge_percentage NUMERIC DEFAULT 0,
    service_charge_enabled BOOLEAN DEFAULT FALSE,
    custom_service_charge NUMERIC DEFAULT 0,
    wallet_balance NUMERIC DEFAULT 0,
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
    kyc_rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MANAGEMENT TABLES
-- QR Settings
CREATE TABLE IF NOT EXISTS public.qr_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    qr_url TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row_only CHECK (id = 1)
);

INSERT INTO public.qr_settings (id, is_enabled) VALUES (1, TRUE) ON CONFLICT (id) DO NOTHING;

-- Headlines (Announcements)
CREATE TABLE IF NOT EXISTS public.headlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rejection Reasons
CREATE TABLE IF NOT EXISTS public.rejection_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    show_in_bill BOOLEAN DEFAULT TRUE,
    show_in_qr BOOLEAN DEFAULT TRUE,
    show_in_kyc BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rejection_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.rejection_categories(id) ON DELETE CASCADE,
    reason_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    branch_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service Charge Slabs
CREATE TABLE IF NOT EXISTS public.service_charge_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_amount NUMERIC NOT NULL,
    max_amount NUMERIC NOT NULL,
    charge_amount NUMERIC NOT NULL,
    is_percentage BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Details
CREATE TABLE IF NOT EXISTS public.bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Policies
CREATE TABLE IF NOT EXISTS public.app_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUBMISSION & TRANSACTION TABLES
-- KYC Submissions
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    aadhaar_front_url TEXT NOT NULL,
    aadhaar_back_url TEXT NOT NULL,
    pan_card_url TEXT NOT NULL,
    cheque_photo_url TEXT NOT NULL,
    selfie_url TEXT NOT NULL,
    firm_photo_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill Submissions
CREATE TABLE IF NOT EXISTS public.bill_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    customer_mobile TEXT NOT NULL,
    card_bank TEXT NOT NULL,
    card_number TEXT NOT NULL,
    card_owner_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    charges NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    remaining_balance NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QR Payment Submissions
CREATE TABLE IF NOT EXISTS public.payment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    utr_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    proof_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    charges NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. COMMUNICATION & MESSAGING
-- Complaints
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.complaint_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SECURITY POLICIES (RLS)
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.headlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejection_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejection_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_charge_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_policies ENABLE ROW LEVEL SECURITY;

-- Public/Login Policies
CREATE POLICY "admin_profiles_read" ON public.admin_profiles FOR SELECT USING (true);
CREATE POLICY "users_profiles_read" ON public.users_profiles FOR SELECT USING (true);
CREATE POLICY "users_profiles_insert" ON public.users_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "users_profiles_update" ON public.users_profiles FOR UPDATE USING (true);

-- Global Admin Tables (Public Read, Admin Write)
CREATE POLICY "qr_settings_read" ON public.qr_settings FOR SELECT USING (true);
CREATE POLICY "qr_settings_write" ON public.qr_settings FOR ALL USING (true); -- Simplified

CREATE POLICY "headlines_all" ON public.headlines FOR ALL USING (true);
CREATE POLICY "rejection_categories_all" ON public.rejection_categories FOR ALL USING (true);
CREATE POLICY "rejection_reasons_all" ON public.rejection_reasons FOR ALL USING (true);
CREATE POLICY "bank_accounts_read" ON public.bank_accounts FOR SELECT USING (true);
CREATE POLICY "service_charge_slabs_all" ON public.service_charge_slabs FOR ALL USING (true);
CREATE POLICY "bank_details_read" ON public.bank_details FOR SELECT USING (true);
CREATE POLICY "bank_details_write" ON public.bank_details FOR ALL USING (true);
CREATE POLICY "app_policies_read" ON public.app_policies FOR SELECT USING (true);
CREATE POLICY "app_policies_write" ON public.app_policies FOR ALL USING (true);

-- User-Specific Data Policies
-- Using (true) for all because the frontend applies its own filtering by mobile/id
CREATE POLICY "kyc_submissions_access" ON public.kyc_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "bill_submissions_access" ON public.bill_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "payment_submissions_access" ON public.payment_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "complaints_access" ON public.complaints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "notifications_access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Disable RLS for messaging tables if needed for simplified testing
ALTER TABLE public.complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- 7. REALTIME ENABLEMENT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.headlines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 8. STORAGE SETUP
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('profiles', 'profiles', true),
  ('qr_codes', 'qr_codes', true),
  ('kyc', 'kyc', true),
  ('proofs', 'proofs', true),
  ('bank_logos', 'bank_logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public storage access" ON storage.objects FOR ALL USING (true);

-- 9. SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
