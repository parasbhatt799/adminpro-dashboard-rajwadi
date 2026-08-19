-- Add DS Minimum Fund Transfer Limit and MD Minimum Fund Transfer Limit columns to qr_settings table
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS ds_min_fund_transfer_limit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS md_min_fund_transfer_limit NUMERIC DEFAULT 0;
