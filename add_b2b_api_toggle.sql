-- Add is_api_enabled toggle column to b2b_settings
ALTER TABLE public.b2b_settings 
ADD COLUMN IF NOT EXISTS is_api_enabled BOOLEAN DEFAULT true;
