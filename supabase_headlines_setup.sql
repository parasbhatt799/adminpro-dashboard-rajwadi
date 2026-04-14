-- Setup script for headlines (News Ticker) table

CREATE TABLE IF NOT EXISTS public.headlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.headlines ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "headlines_read_access" ON public.headlines;
    DROP POLICY IF EXISTS "headlines_admin_access" ON public.headlines;

    -- Everyone can read active headlines
    CREATE POLICY "headlines_read_access" ON public.headlines
        FOR SELECT USING (is_active = true);

    -- Admins have full access
    CREATE POLICY "headlines_admin_access" ON public.headlines
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users_profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
        );
END $$;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.headlines;
