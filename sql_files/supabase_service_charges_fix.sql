-- Fix for Service Charge Slabs Table and Policies
-- This matches the schema expected by ServiceChargeManagement.tsx

-- 1. Create the table with correct name and columns
CREATE TABLE IF NOT EXISTS public.service_charge_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_amount NUMERIC NOT NULL,
    max_amount NUMERIC NOT NULL,
    charge_amount NUMERIC NOT NULL,
    is_percentage BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.service_charge_slabs ENABLE ROW LEVEL SECURITY;

-- 3. Drop old policies if any
DROP POLICY IF EXISTS "service_charge_slabs_read" ON public.service_charge_slabs;
DROP POLICY IF EXISTS "service_charge_slabs_all" ON public.service_charge_slabs;

-- 4. Create proper policies for Admin management
-- Allow all operations for now (can be restricted to admin role later)
CREATE POLICY "service_charge_slabs_all" 
ON public.service_charge_slabs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'service_charge_slabs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_charge_slabs;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE public.service_charge_slabs;
END $$;
