ALTER TABLE public.payout_submissions ADD COLUMN IF NOT EXISTS api_log JSONB;
