-- Create RechargeTransactions Table
CREATE TABLE IF NOT EXISTS public.recharge_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    mobile TEXT NOT NULL,
    operator TEXT NOT NULL,
    circle TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    plan_id TEXT,
    txn_ref_id TEXT,
    request_id TEXT UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('success', 'pending', 'failed')),
    response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RechargePlans Table
CREATE TABLE IF NOT EXISTS public.recharge_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator TEXT NOT NULL,
    circle TEXT NOT NULL,
    plan_name TEXT,
    amount NUMERIC NOT NULL,
    validity TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (RLS) as established in the current project structure
ALTER TABLE public.recharge_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recharge_plans DISABLE ROW LEVEL SECURITY;

-- Reload Schema cache
NOTIFY pgrst, 'reload schema';
