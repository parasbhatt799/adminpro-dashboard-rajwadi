-- Setup script for complaints table

CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    admin_reply TEXT,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "complaints_user_access" ON public.complaints;
    DROP POLICY IF EXISTS "complaints_admin_access" ON public.complaints;

    -- Users can see and insert their own complaints
    CREATE POLICY "complaints_user_access" ON public.complaints
        FOR ALL USING (auth.uid() = user_id);

    -- Admins can see and update all complaints
    CREATE POLICY "complaints_admin_access" ON public.complaints
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users_profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
        );
END $$;
