-- Add phone column to payout_beneficiaries
ALTER TABLE public.payout_beneficiaries ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
