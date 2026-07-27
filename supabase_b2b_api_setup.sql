-- Create table for B2B API Credentials
CREATE TABLE IF NOT EXISTS public.b2b_api_credentials (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL UNIQUE,
    secret_key TEXT NOT NULL,
    ip_whitelist TEXT[] DEFAULT '{}',
    domain_whitelist TEXT[] DEFAULT '{}',
    billavenue_agent_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for B2B API Logs
CREATE TABLE IF NOT EXISTS public.b2b_api_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id TEXT REFERENCES public.users_profiles(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL,
    request_ip TEXT,
    request_payload JSONB,
    response_payload JSONB,
    status_code INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for B2B API Credentials
ALTER TABLE public.b2b_api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage b2b credentials" 
ON public.b2b_api_credentials 
FOR ALL 
TO authenticated 
USING (auth.uid()::text IN (SELECT id::text FROM public.users_profiles WHERE role = 'admin'));

CREATE POLICY "Agents can view their own credentials" 
ON public.b2b_api_credentials 
FOR SELECT 
TO authenticated 
USING (auth.uid()::text = agent_id::text);

-- RLS for B2B API Logs
ALTER TABLE public.b2b_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all b2b logs" 
ON public.b2b_api_logs 
FOR SELECT 
TO authenticated 
USING (auth.uid()::text IN (SELECT id::text FROM public.users_profiles WHERE role = 'admin'));

CREATE POLICY "Agents can view their own logs" 
ON public.b2b_api_logs 
FOR SELECT 
TO authenticated 
USING (auth.uid()::text = agent_id::text);

-- Create function to authenticate B2B request
DROP FUNCTION IF EXISTS authenticate_b2b_api(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION authenticate_b2b_api(p_api_key TEXT, p_secret_key TEXT, p_ip_address TEXT)
RETURNS JSONB AS $$
DECLARE
    v_agent_id TEXT;
    v_billavenue_agent_id TEXT;
    v_is_active BOOLEAN;
    v_ip_whitelist TEXT[];
BEGIN
    SELECT id::text, billavenue_agent_id, is_active, ip_whitelist 
    INTO v_agent_id, v_billavenue_agent_id, v_is_active, v_ip_whitelist
    FROM public.b2b_api_credentials
    WHERE api_key = p_api_key AND secret_key = p_secret_key;

    IF v_agent_id IS NULL THEN
        RAISE EXCEPTION 'Invalid API Key or Secret Key';
    END IF;

    IF NOT v_is_active THEN
        RAISE EXCEPTION 'API Access is disabled for this account';
    END IF;

    IF array_length(v_ip_whitelist, 1) > 0 AND NOT (p_ip_address = ANY(v_ip_whitelist)) THEN
        RAISE EXCEPTION 'IP Address % is not whitelisted', p_ip_address;
    END IF;

    RETURN jsonb_build_object(
        'agent_id', v_agent_id,
        'billavenue_agent_id', v_billavenue_agent_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
