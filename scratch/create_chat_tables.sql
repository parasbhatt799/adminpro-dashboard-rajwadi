-- Drop old tables if they exist to avoid schema mismatch
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_threads CASCADE;

-- 1. Create chat_threads table
CREATE TABLE IF NOT EXISTS public.chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id TEXT NOT NULL, -- Can be 'admin' or another user profile id
    user_b_id TEXT NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE, -- Can be another user profile id, has FK constraint for join queries
    user_a_unread INTEGER DEFAULT 0,
    user_b_unread INTEGER DEFAULT 0,
    last_message TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_a_id, user_b_id)
);

-- 2. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL, -- Can be 'admin' or user ID
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
    message TEXT, -- Optional text message
    file_url TEXT, -- URL of uploaded file/image
    file_type TEXT DEFAULT 'text' CHECK (file_type IN ('text', 'image', 'file')),
    admin_name TEXT, -- Stores the name of the replying admin
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Disable RLS for compatibility (matching complaints & notifications tables)
ALTER TABLE public.chat_threads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;

-- Set replica identity full for realtime tracking
ALTER TABLE public.chat_threads REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- 4. Enable Supabase Realtime for these tables
DO $$
BEGIN
  -- Add to publication if it exists
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads, public.chat_messages;
  END IF;
END $$;

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
