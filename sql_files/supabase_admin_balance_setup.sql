-- Add admin_balance column to qr_settings table
ALTER TABLE public.qr_settings 
ADD COLUMN IF NOT EXISTS admin_balance NUMERIC DEFAULT 0;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
