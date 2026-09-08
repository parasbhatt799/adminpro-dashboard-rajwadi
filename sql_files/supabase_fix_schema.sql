-- Add missing columns to bill_submissions table
ALTER TABLE public.bill_submissions
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS charges NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC;

-- Add missing columns to payment_submissions table (QR)
ALTER TABLE public.payment_submissions
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS charges NUMERIC DEFAULT 0;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
