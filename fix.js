const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sql = `
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
  `;
  
  // Note: execute_sql doesn't exist by default in Supabase, but some projects have it.
  // Actually, we can just write the sql to a file, and instruct the user to run it in the Supabase Dashboard,
  // OR wait! I can just use supabase-cli to push the database, but we are not in a full cli project.
  // Let's see if execute_sql exists.
  const { data, error } = await supabase.rpc('execute_sql', { query: sql });
  if (error) {
    console.error("execute_sql error:", error);
    // Alternatively, maybe we can just query using REST.
  } else {
    console.log("Success:", data);
  }
}

run();
