-- Setup script for Multi-Message Complaints (Ticketing) System

CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.complaint_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for custom auth compatibility
ALTER TABLE public.complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_messages DISABLE ROW LEVEL SECURITY;

-- Grant permissions for anon key
GRANT ALL ON public.complaints TO anon;
GRANT ALL ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;

GRANT ALL ON public.complaint_messages TO anon;
GRANT ALL ON public.complaint_messages TO authenticated;
GRANT ALL ON public.complaint_messages TO service_role;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
