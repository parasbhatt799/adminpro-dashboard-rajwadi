-- Migration for B2B Charge Split (Developer Charge & Owner Charge)
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS developer_charge NUMERIC DEFAULT 0;
ALTER TABLE public.b2b_api_credentials ADD COLUMN IF NOT EXISTS owner_charge NUMERIC DEFAULT 0;

ALTER TABLE public.b2b_api_logs ADD COLUMN IF NOT EXISTS developer_charge NUMERIC DEFAULT 0;
ALTER TABLE public.b2b_api_logs ADD COLUMN IF NOT EXISTS owner_charge NUMERIC DEFAULT 0;
