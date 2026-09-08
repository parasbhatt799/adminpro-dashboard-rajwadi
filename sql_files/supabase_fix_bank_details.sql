-- 1. Add missing columns to bank_details
ALTER TABLE public.bank_details 
ADD COLUMN IF NOT EXISTS show_in_bill_payment BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_in_payout BOOLEAN DEFAULT FALSE;

-- 2. Refresh the schema cache
NOTIFY pgrst, 'reload schema';
