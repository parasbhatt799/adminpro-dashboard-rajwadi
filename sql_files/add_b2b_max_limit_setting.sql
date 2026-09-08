-- Add max_bill_payment_limit to b2b_settings and b2b_api_credentials

ALTER TABLE public.b2b_settings 
ADD COLUMN IF NOT EXISTS max_bill_payment_limit NUMERIC(10, 2) DEFAULT 100000.00;

ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS custom_max_bill_payment_limit NUMERIC(10, 2) DEFAULT 0.00;

-- Update default max limit to 100000 if null
UPDATE public.b2b_settings 
SET max_bill_payment_limit = 100000.00 
WHERE max_bill_payment_limit IS NULL;

NOTIFY pgrst, 'reload schema';
