-- Create advertising settings table
CREATE TABLE IF NOT EXISTS public.advertising (
    id INTEGER PRIMARY KEY DEFAULT 1,
    banner_url TEXT,
    redirect_link TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure is_active column exists (in case table was already created)
ALTER TABLE public.advertising ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Insert default placeholder row
INSERT INTO public.advertising (id, banner_url, redirect_link, is_active)
VALUES (1, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024', 'https://www.usepay.in', true)
ON CONFLICT (id) DO NOTHING;

-- Enable public RLS policies
ALTER TABLE public.advertising ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.advertising;
CREATE POLICY "Allow public read access" ON public.advertising FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public update access" ON public.advertising;
CREATE POLICY "Allow public update access" ON public.advertising FOR ALL USING (true);

-- Enable Realtime conditionally to avoid duplicate membership errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr 
        JOIN pg_class c ON pr.prrelid = c.oid 
        WHERE c.relname = 'advertising'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.advertising;
    END IF;
END $$;
