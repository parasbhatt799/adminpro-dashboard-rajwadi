-- Add mapping toggles to rejection_categories
ALTER TABLE public.rejection_categories 
ADD COLUMN IF NOT EXISTS show_in_bill BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS show_in_qr BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS show_in_kyc BOOLEAN DEFAULT FALSE;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
