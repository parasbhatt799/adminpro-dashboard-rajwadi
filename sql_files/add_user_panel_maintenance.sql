-- Add user panel maintenance column to system_status table
ALTER TABLE public.system_status ADD COLUMN IF NOT EXISTS is_user_panel_enabled BOOLEAN DEFAULT TRUE;

-- Ensure the row with id=1 exists
INSERT INTO public.system_status (id, is_enabled, is_user_panel_enabled, message)
VALUES (1, TRUE, TRUE, 'System is under maintenance')
ON CONFLICT (id) DO UPDATE SET is_user_panel_enabled = TRUE;
