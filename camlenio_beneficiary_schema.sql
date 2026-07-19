-- Create payout_beneficiaries table
CREATE TABLE IF NOT EXISTS public.payout_beneficiaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    holder_name TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, account_number, ifsc_code)
);

-- Enable RLS
ALTER TABLE public.payout_beneficiaries ENABLE ROW LEVEL SECURITY;

-- Allow all operations (matching other tables in this app)
CREATE POLICY "payout_beneficiaries_all" 
ON public.payout_beneficiaries 
FOR ALL USING (true) WITH CHECK (true);
