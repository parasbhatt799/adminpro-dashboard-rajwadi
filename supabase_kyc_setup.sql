-- Add password and KYC fields to users_profiles
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;

-- Create kyc_submissions table
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
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

-- Enable RLS
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- Policies for KYC
CREATE POLICY "kyc_submissions_owner_read" ON public.kyc_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kyc_submissions_owner_insert" ON public.kyc_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kyc_submissions_admin_all" ON public.kyc_submissions FOR ALL USING (true); -- Simplified for admin access

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
