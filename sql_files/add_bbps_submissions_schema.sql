-- Create bbps_submissions table for official secure BBPS gateway logs
CREATE TABLE IF NOT EXISTS public.bbps_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE SET NULL,
    service_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    consumer_number TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    charges NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'approved',
    transaction_id TEXT,
    rejection_reason TEXT, -- Stores PayPrime TXN Reference / UTR
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.bbps_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "bbps_submissions_user_access" ON public.bbps_submissions;
DROP POLICY IF EXISTS "bbps_submissions_admin_access" ON public.bbps_submissions;

-- Create policies for RLS
CREATE POLICY "bbps_submissions_user_access" ON public.bbps_submissions
    FOR ALL USING (user_id = auth.uid()::text);

CREATE POLICY "bbps_submissions_admin_access" ON public.bbps_submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users_profiles
            WHERE users_profiles.id = auth.uid()::text AND users_profiles.role = 'admin'
        )
    );

-- Add to supabase realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bbps_submissions;
ALTER TABLE public.bbps_submissions REPLICA IDENTITY FULL;

NOTIFY pgrst, 'reload schema';
