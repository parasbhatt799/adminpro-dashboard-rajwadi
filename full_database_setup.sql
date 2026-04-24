-- =============================================================
-- MASTER DATABASE SETUP COMPLETED - USEPAY
-- =============================================================
-- This script contains ALL Tables, Buckets, and Policies.
-- Run this in Supabase SQL Editor to reset and setup EVERYTHING.
 
-- 1. CUSTOM ID GENERATOR (usepay_001)
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 1;
CREATE OR REPLACE FUNCTION generate_user_id() RETURNS TEXT AS $$
BEGIN
    RETURN 'usepay_' || LPAD(nextval('user_id_seq')::text, 3, '0');
END;
$$ LANGUAGE plpgsql;
 
-- 2. TABLES
-- Admin profiles
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mobile_number text UNIQUE NOT NULL,
  password text NOT NULL,
  role text DEFAULT 'full' CHECK (role IN ('full', 'limited')),
  status text DEFAULT 'Active' CHECK (status IN ('Active', 'Blocked')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
 
INSERT INTO public.admin_profiles (mobile_number, password)
VALUES ('8140428671', 'admin123') ON CONFLICT (mobile_number) DO NOTHING;
 
-- Ensure existing columns and roles are correct
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'full';
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Blocked'));
ALTER TABLE public.admin_profiles ADD COLUMN IF NOT EXISTS onesignal_id TEXT;
UPDATE public.admin_profiles SET role = 'full' WHERE role IS NULL;
UPDATE public.admin_profiles SET status = 'Active' WHERE status IS NULL;
ALTER TABLE public.bank_details 
ADD COLUMN IF NOT EXISTS show_in_bill_payment BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_in_payout BOOLEAN DEFAULT FALSE;
 
-- User profiles
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
    onesignal_id TEXT,
    hold_balance NUMERIC DEFAULT 0,
    distributor_id TEXT REFERENCES public.users_profiles(id),
    admin_base_qr_charge NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Management & Admin Tables
CREATE TABLE IF NOT EXISTS public.qr_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    qr_url TEXT,
    logo_url TEXT,
    logo_mini_url TEXT,
    favicon_url TEXT,
    admin_balance NUMERIC DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row_only CHECK (id = 1)
);
INSERT INTO public.qr_settings (id, is_enabled) VALUES (1, TRUE) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.payout_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    fixed_charge NUMERIC DEFAULT 10,
    is_percentage BOOLEAN DEFAULT FALSE,
    processing_time_1_mins INTEGER DEFAULT 45,
    processing_time_2_mins INTEGER DEFAULT 55,
    pending_time_mins INTEGER DEFAULT 15,
    min_payout NUMERIC DEFAULT 100,
    max_payout NUMERIC DEFAULT 50000,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row_only_payout CHECK (id = 1)
);
INSERT INTO public.payout_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.onesignal_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    app_id TEXT,
    rest_api_key TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row_only_os CHECK (id = 1)
);
INSERT INTO public.onesignal_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.whatsapp_api_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    access_token TEXT,
    phone_number_id TEXT,
    recipient_number TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row_only_ws CHECK (id = 1)
);
INSERT INTO public.whatsapp_api_settings (id, is_active) VALUES (1, TRUE) ON CONFLICT (id) DO NOTHING;
 
CREATE TABLE IF NOT EXISTS public.headlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
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
 
CREATE TABLE IF NOT EXISTS public.service_charge_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_amount NUMERIC NOT NULL,
    max_amount NUMERIC NOT NULL,
    charge_amount NUMERIC NOT NULL,
    is_percentage BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
CREATE TABLE IF NOT EXISTS public.bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    show_in_bill_payment BOOLEAN DEFAULT TRUE,
    show_in_payout BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
CREATE TABLE IF NOT EXISTS public.app_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_status (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_enabled BOOLEAN DEFAULT TRUE,
    message TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row_only_sys CHECK (id = 1)
);
INSERT INTO public.system_status (id, is_enabled, message) VALUES (1, TRUE, 'System is currently under maintenance. Please try again later.') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC NOT NULL,
    remark TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Transaction & Submission Tables
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
 
CREATE TABLE IF NOT EXISTS public.qr_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_name TEXT NOT NULL,
    qr_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    whatsapp_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    qr_id UUID REFERENCES public.qr_history(id),
    utr_id TEXT NOT NULL,
    card_number TEXT,
    amount NUMERIC NOT NULL,
    proof_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    charges NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payout_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    charge_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'rejected')),
    transaction_id TEXT,
    proof_url TEXT,
    remark TEXT,
    remaining_balance NUMERIC,
    processing_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Support Tables
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
 
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    target_role TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- 3. POLICIES (RLS)
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.headlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejection_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rejection_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_charge_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onesignal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_api_settings ENABLE ROW LEVEL SECURITY;
 
-- Allow all for management (Simplified for Custom Auth)
CREATE POLICY "admin_profiles_all" ON public.admin_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "users_profiles_all" ON public.users_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qr_settings_all" ON public.qr_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "headlines_all" ON public.headlines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "rejection_categories_all" ON public.rejection_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "rejection_reasons_all" ON public.rejection_reasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_charge_slabs_all" ON public.service_charge_slabs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "bank_details_all" ON public.bank_details FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "app_policies_all" ON public.app_policies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "system_status_all" ON public.system_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_withdrawals_all" ON public.admin_withdrawals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "kyc_submissions_all" ON public.kyc_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "bill_submissions_all" ON public.bill_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "payment_submissions_all" ON public.payment_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "payout_submissions_all" ON public.payout_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qr_history_all" ON public.qr_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "payout_settings_all" ON public.payout_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "onesignal_settings_all" ON public.onesignal_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "whatsapp_settings_all" ON public.whatsapp_api_settings FOR ALL USING (true) WITH CHECK (true);
 
-- Disable RLS for messaging tables for better compatibility
ALTER TABLE public.complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
 
-- 4. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('profiles', 'profiles', true),
  ('qr_codes', 'qr_codes', true),
  ('kyc', 'kyc', true),
  ('payment_proofs', 'payment_proofs', true),
  ('bank_logos', 'bank_logos', true),
  ('site_assets', 'site_assets', true)
ON CONFLICT (id) DO NOTHING;
 
-- Storage Policies
CREATE POLICY "Allow public all access" ON storage.objects FOR ALL USING (true) WITH CHECK (true);
 
-- 5. REALTIME ENABLEMENT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
 
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.qr_settings,
  public.payout_settings,
  public.onesignal_settings,
  public.headlines,
  public.users_profiles,
  public.bill_submissions,
  public.payment_submissions,
  public.payout_submissions,
  public.kyc_submissions,
  public.complaints,
  public.notifications,
  public.system_status,
  public.admin_withdrawals;

-- Add sound settings to qr_settings
ALTER TABLE qr_settings 
ADD COLUMN IF NOT EXISTS qr_sound_url TEXT,
ADD COLUMN IF NOT EXISTS bill_sound_url TEXT,
ADD COLUMN IF NOT EXISTS payout_sound_url TEXT,
ADD COLUMN IF NOT EXISTS kyc_sound_url TEXT,
ADD COLUMN IF NOT EXISTS is_qr_sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_bill_sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_payout_sound_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_kyc_sound_enabled BOOLEAN DEFAULT true;
ALTER TABLE qr_settings ADD COLUMN is_bill_enabled BOOLEAN DEFAULT true;
ALTER TABLE qr_settings ADD COLUMN IF NOT EXISTS is_bill_enabled BOOLEAN DEFAULT true;

-- Create OneSignal settings table
CREATE TABLE IF NOT EXISTS public.onesignal_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    app_id TEXT,
    rest_api_key TEXT,
    is_enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row_only CHECK (id = 1)
);
 
-- Enable RLS
ALTER TABLE public.onesignal_settings ENABLE ROW LEVEL SECURITY;
 
-- Allow all for management
DROP POLICY IF EXISTS "onesignal_settings_all" ON public.onesignal_settings;
CREATE POLICY "onesignal_settings_all" ON public.onesignal_settings FOR ALL USING (true) WITH CHECK (true);
 
-- Insert initial row
INSERT INTO public.onesignal_settings (id, is_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- GIVE PERMISSION TO USERS TO SEND NOTIFICATIONS
DROP POLICY IF EXISTS "Allow authenticated to read onesignal_settings" ON onesignal_settings;
CREATE POLICY "Allow authenticated to read onesignal_settings" 
ON onesignal_settings FOR SELECT 
TO authenticated 
USING (true);

 -- 1. Ensure the onesignal_settings table is readable by all logged-in users

DROP POLICY IF EXISTS "Allow authenticated to read onesignal_settings" ON onesignal_settings;
CREATE POLICY "Allow authenticated to read onesignal_settings" 
ON onesignal_settings FOR SELECT 
TO authenticated 
USING (true);
 
-- 2. Make sure you have a record with ID 1 (Important!)
INSERT INTO onesignal_settings (id, is_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;
 
ALTER TABLE qr_settings ADD COLUMN IF NOT EXISTS watermark_url TEXT;
ALTER TABLE qr_settings ADD COLUMN IF NOT EXISTS is_watermark_enabled BOOLEAN DEFAULT false;

-- 2. Create whatsapp_api_settings table for credentials
CREATE TABLE IF NOT EXISTS public.whatsapp_api_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    is_active BOOLEAN DEFAULT FALSE,
    access_token TEXT,
    phone_number_id TEXT,
    sender_number TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- 3. Enable RLS
ALTER TABLE public.whatsapp_api_settings ENABLE ROW LEVEL SECURITY;
 
-- 4. Policies
DROP POLICY IF EXISTS "whatsapp_settings_all" ON public.whatsapp_api_settings;
CREATE POLICY "whatsapp_settings_all" ON public.whatsapp_api_settings FOR ALL USING (true) WITH CHECK (true);
 
-- 5. Seed initial row if not exists
INSERT INTO public.whatsapp_api_settings (id, is_active)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- Allow all access to the withdrawals table
CREATE POLICY "Enable all access" ON admin_withdrawals FOR ALL USING (true) WITH CHECK (true);


-- 1. Create a function to check admin status without causing a loop
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users_profiles 
    WHERE id = auth.uid()::text AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a function to check distributor status
CREATE OR REPLACE FUNCTION public.is_distributor() 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users_profiles 
    WHERE id = auth.uid()::text AND role = 'distributor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Clear old policies
DROP POLICY IF EXISTS "Admin full access" ON public.users_profiles;
DROP POLICY IF EXISTS "Distributor manage sub-users" ON public.users_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users_profiles;

-- 4. NEW POLICIES (No recursion)

-- A. Admin has full access to everything
CREATE POLICY "Admin_Full_Access" ON public.users_profiles
FOR ALL USING ( public.is_admin() );

-- B. Distributors can manage their own sub-users
CREATE POLICY "Distributor_Manage_Users" ON public.users_profiles
FOR ALL USING ( distributor_id = auth.uid()::text )
WITH CHECK ( distributor_id = auth.uid()::text );

-- C. Users can see their own profile
CREATE POLICY "User_Self_View" ON public.users_profiles
FOR SELECT USING ( id = auth.uid()::text );

-- 5. Refresh the cache



NOTIFY pgrst, 'reload schema';