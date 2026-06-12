-- ==========================================================
-- MIGRATION: ADD t_plus_one COLUMN TO public.qr_master
-- ==========================================================

-- Add t_plus_one column to qr_master table if it doesn't exist
ALTER TABLE public.qr_master ADD COLUMN IF NOT EXISTS t_plus_one BOOLEAN DEFAULT FALSE;

-- Reload schema to update PostgREST cache
NOTIFY pgrst, 'reload schema';
