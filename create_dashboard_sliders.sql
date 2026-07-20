-- Create dashboard_sliders table
CREATE TABLE IF NOT EXISTS public.dashboard_sliders (
    id SERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.dashboard_sliders ENABLE ROW LEVEL SECURITY;

-- Allow read access to anyone
CREATE POLICY "Allow public read access to dashboard_sliders"
    ON public.dashboard_sliders
    FOR SELECT
    TO public
    USING (true);

-- Allow all operations for authenticated users (Admin)
CREATE POLICY "Allow admin full access to dashboard_sliders"
    ON public.dashboard_sliders
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
