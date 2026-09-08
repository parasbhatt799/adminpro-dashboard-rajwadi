-- Add webhook_url column to b2b_api_credentials for sending asynchronous payment status updates
ALTER TABLE public.b2b_api_credentials 
ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Update b2b_api_logs table to ensure payment_status column exists and is used
ALTER TABLE public.b2b_api_logs
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Add charge_deducted if not already exists (for refund calculation)
ALTER TABLE public.b2b_api_logs
ADD COLUMN IF NOT EXISTS charge_deducted NUMERIC(10,2) DEFAULT 0.00;

-- Create table to track webhook deliveries
CREATE TABLE IF NOT EXISTS public.b2b_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
