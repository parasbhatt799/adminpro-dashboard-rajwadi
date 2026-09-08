-- Add transaction_id and metadata columns to bill_submissions table for storing detailed BBPS receipts
ALTER TABLE public.bill_submissions 
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;
