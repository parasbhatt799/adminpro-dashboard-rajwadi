-- Add webhook_url column to b2b_api_credentials for sending asynchronous payment status updates
ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Update b2b_api_logs table to ensure payment_status column exists and is used
ALTER TABLE public.b2b_api_logs
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Add charge_deducted if not already exists (for refund calculation)
ALTER TABLE public.b2b_api_logs
ADD COLUMN IF NOT EXISTS charge_deducted NUMERIC(10,2) DEFAULT 0.00;
