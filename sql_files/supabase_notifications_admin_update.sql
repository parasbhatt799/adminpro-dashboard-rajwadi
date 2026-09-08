-- Update Notifications table for Admin support

-- 1. Add target_role column
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'user' CHECK (target_role IN ('user', 'admin'));

-- 2. Make user_id optional (since admin notifications don't need a specific user_id in this context)
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;

-- 3. Index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON public.notifications(target_role);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
