-- Remove old strict policies that blocked users
DROP POLICY IF EXISTS "Users can manage their own beneficiaries" ON public.payout_beneficiaries;
DROP POLICY IF EXISTS "Admins can view all beneficiaries" ON public.payout_beneficiaries;

-- Add universal access policy matching the rest of the application
CREATE POLICY "payout_beneficiaries_all" ON public.payout_beneficiaries FOR ALL USING (true) WITH CHECK (true);
