-- Create advertising settings table
CREATE TABLE IF NOT EXISTS public.advertising (
    id INTEGER PRIMARY KEY DEFAULT 1,
    banner_url TEXT,
    redirect_link TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default placeholder row
INSERT INTO public.advertising (id, banner_url, redirect_link)
VALUES (1, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1024', 'https://www.usepay.in')
ON CONFLICT (id) DO NOTHING;

-- Enable public RLS policies
ALTER TABLE public.advertising ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.advertising;
CREATE POLICY "Allow public read access" ON public.advertising FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public update access" ON public.advertising;
CREATE POLICY "Allow public update access" ON public.advertising FOR ALL USING (true);

-- Enable Realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.advertising;
