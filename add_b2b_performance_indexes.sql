-- Performance Indexes for B2B API Logs Table
-- Speed up Bill History queries and background cron jobs

CREATE INDEX IF NOT EXISTS idx_b2b_api_logs_created_at 
ON public.b2b_api_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_api_logs_endpoint_created 
ON public.b2b_api_logs (endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_api_logs_agent_created 
ON public.b2b_api_logs (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_api_logs_status 
ON public.b2b_api_logs (payment_status, status_code);
