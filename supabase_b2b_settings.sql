-- Create B2B Global Settings table
CREATE TABLE IF NOT EXISTS public.b2b_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_charge_per_bill numeric(10, 2) NOT NULL DEFAULT 0.00,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure there is always exactly one row for global settings
INSERT INTO public.b2b_settings (id, global_charge_per_bill)
SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 0.00
WHERE NOT EXISTS (SELECT 1 FROM public.b2b_settings);

-- Enable RLS
ALTER TABLE public.b2b_settings ENABLE ROW LEVEL SECURITY;

-- Allow all access to b2b_settings (simplified policy for this project)
CREATE POLICY "b2b_settings_all_access" ON public.b2b_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Function to handle timestamp update
CREATE OR REPLACE FUNCTION public.handle_updated_at_b2b_settings()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for timestamp
DROP TRIGGER IF EXISTS set_b2b_settings_updated_at ON public.b2b_settings;
CREATE TRIGGER set_b2b_settings_updated_at
  BEFORE UPDATE ON public.b2b_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_b2b_settings();
