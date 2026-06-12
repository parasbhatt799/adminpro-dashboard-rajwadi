-- Migration to add separate toggles for T+1 service and visibility
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS is_t_plus_one_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_t_plus_one_service_enabled BOOLEAN DEFAULT TRUE;
