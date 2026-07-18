-- =============================================================
-- DATABASE SETUP FOR CAMLENIO CSPL BBPS
-- =============================================================

-- 1. Create Biller Master Table for CSPL
CREATE TABLE IF NOT EXISTS public.cspl_billers (
    biller_id TEXT PRIMARY KEY,
    biller_name TEXT NOT NULL,
    category TEXT NOT NULL,
    biller_coverage TEXT,
    status TEXT DEFAULT 'ACTIVE',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) for public access
ALTER TABLE public.cspl_billers DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
