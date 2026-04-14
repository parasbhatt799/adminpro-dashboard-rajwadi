-- FINAL FIX for headlines (News Ticker) table access
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.headlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.headlines ENABLE ROW LEVEL SECURITY;

-- Drop all old policies
DROP POLICY IF EXISTS "headlines_read_access" ON public.headlines;
DROP POLICY IF EXISTS "headlines_admin_all" ON public.headlines;
DROP POLICY IF EXISTS "headlines_all_access" ON public.headlines;

-- Create a simplified policy that allows all operations
-- Note: This matches the project's pattern for admin-only tables like qr_settings
CREATE POLICY "headlines_all_access" ON public.headlines
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable Realtime
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'headlines'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.headlines;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- If publication doesn't exist at all
    CREATE PUBLICATION supabase_realtime FOR TABLE public.headlines;
END $$;
