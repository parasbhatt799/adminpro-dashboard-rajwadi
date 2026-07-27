-- Add charge_per_bill to b2b_api_credentials
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS charge_per_bill NUMERIC DEFAULT 0.00;

-- Add charge_deducted to b2b_api_logs
ALTER TABLE public.b2b_api_logs ADD COLUMN IF NOT EXISTS charge_deducted NUMERIC DEFAULT 0.00;
