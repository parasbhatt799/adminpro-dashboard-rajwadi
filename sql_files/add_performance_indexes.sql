-- Performance Database Indexing Migration Script for Supabase PostgreSQL
-- Creates indexes on frequently queried tables and columns to speed up dashboard queries

CREATE INDEX IF NOT EXISTS idx_bbps_submissions_created_status 
ON public.bbps_submissions (created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_bbps_submissions_user_id 
ON public.bbps_submissions (user_id);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_created_status 
ON public.payment_submissions (created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_user_id 
ON public.payment_submissions (user_id);

CREATE INDEX IF NOT EXISTS idx_payout_submissions_created_status 
ON public.payout_submissions (created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_payout_submissions_user_id 
ON public.payout_submissions (user_id);

CREATE INDEX IF NOT EXISTS idx_billavenue_billers_category 
ON public.billavenue_billers (category);

CREATE INDEX IF NOT EXISTS idx_users_profiles_role 
ON public.users_profiles (role);
