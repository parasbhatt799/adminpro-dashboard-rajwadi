-- Migration to add billavenue_agent_id to b2b_api_credentials

-- 1. Add column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'b2b_api_credentials' 
                   AND column_name = 'billavenue_agent_id') THEN
        ALTER TABLE public.b2b_api_credentials ADD COLUMN billavenue_agent_id TEXT;
    END IF;
END $$;

-- 2. Update the authentication function to return a JSON object with both IDs
DROP FUNCTION IF EXISTS authenticate_b2b_api(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION authenticate_b2b_api(p_api_key TEXT, p_secret_key TEXT, p_ip_address TEXT)
RETURNS JSONB AS $$
DECLARE
    v_agent_id TEXT;
    v_billavenue_agent_id TEXT;
    v_is_active BOOLEAN;
    v_ip_whitelist TEXT[];
BEGIN
    SELECT agent_id, billavenue_agent_id, is_active, ip_whitelist 
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
