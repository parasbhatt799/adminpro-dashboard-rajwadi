-- Updated Setup script for headlines (News Ticker) table
-- Run this in Supabase SQL Editor to fix the RLS error

CREATE TABLE IF NOT EXISTS public.headlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.headlines ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid conflicts
DROP POLICY IF EXISTS "headlines_read_access" ON public.headlines;
DROP POLICY IF EXISTS "headlines_admin_access" ON public.headlines;
DROP POLICY IF EXISTS "headlines_admin_all" ON public.headlines;

-- 1. Everyone (Authenticated or Anon) can read active headlines
CREATE POLICY "headlines_read_access" ON public.headlines
    FOR SELECT USING (is_active = true);

-- 2. Admins have FULL access (SELECT, INSERT, UPDATE, DELETE)
-- This policy checks the 'role' column in workers_profiles or users_profiles
CREATE POLICY "headlines_admin_all" ON public.headlines
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users_profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users_profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Enable Realtime
-- Use 'ALTER' if publication already exists, otherwise it might error.
-- This part is usually safe to run multiple times.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.headlines;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
