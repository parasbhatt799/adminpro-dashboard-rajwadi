-- 1. Add commission_balance to users_profiles
ALTER TABLE public.users_profiles 
ADD COLUMN IF NOT EXISTS commission_balance NUMERIC DEFAULT 0;

-- 2. Create distributor_withdrawals table
CREATE TABLE IF NOT EXISTS public.distributor_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id TEXT NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    bank_details JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    remark TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.distributor_withdrawals ENABLE ROW LEVEL SECURITY;

-- 4. Policies for distributor_withdrawals
CREATE POLICY "Distributors can view own withdrawals" 
ON public.distributor_withdrawals FOR SELECT 
USING ( distributor_id = auth.uid()::text );

CREATE POLICY "Distributors can create withdrawal requests" 
ON public.distributor_withdrawals FOR INSERT 
WITH CHECK ( distributor_id = auth.uid()::text );

CREATE POLICY "Admin full access to distributor withdrawals" 
ON public.distributor_withdrawals FOR ALL 
USING ( EXISTS (
    SELECT 1 FROM public.users_profiles 
    WHERE id = auth.uid()::text AND role = 'admin'
) );

-- 5. Migration: Move existing wallet_balance to commission_balance for distributors
UPDATE public.users_profiles 
SET commission_balance = wallet_balance, wallet_balance = 0
WHERE role = 'distributor';

-- 6. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.distributor_withdrawals;

-- 7. Refresh schema
NOTIFY pgrst, 'reload schema';
