-- Migration to add separate provider max limits to qr_settings

ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS billavenue_max_limit NUMERIC DEFAULT 49999,
ADD COLUMN IF NOT EXISTS cspl_max_limit NUMERIC DEFAULT 49999;

-- Set defaults for existing row if id=1 exists
UPDATE public.qr_settings 
SET 
  billavenue_max_limit = COALESCE(billavenue_max_limit, 49999),
  cspl_max_limit = COALESCE(cspl_max_limit, 49999),
  bbps_max_limit = COALESCE(bbps_max_limit, 49999)
WHERE id = 1;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
