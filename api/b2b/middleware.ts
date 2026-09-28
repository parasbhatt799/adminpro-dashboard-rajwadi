import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../server'; // Assume server exports supabaseAdmin or we recreate it

export const b2bAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Resolve real client public IP from proxy headers (Cloudflare, Nginx X-Real-IP, X-Forwarded-For, etc.)
  const forwardedHeader = req.header('x-forwarded-for');
  const forwardedIps = forwardedHeader 
    ? forwardedHeader.split(',').map(s => s.trim().replace(/^::ffff:/, '')).filter(Boolean)
    : [];

  const candidateIps: string[] = Array.from(new Set([
    req.header('cf-connecting-ip'),
    req.header('x-real-ip'),
    ...forwardedIps,
    req.header('true-client-ip'),
    req.header('x-client-ip'),
    req.ip,
    req.socket.remoteAddress
  ].filter((ip): ip is string => Boolean(ip && typeof ip === 'string' && ip.trim().length > 0))
   .map(ip => ip.replace(/^::ffff:/, '').trim())));

  const apiKey = req.header('x-api-key');
  const secretKey = req.header('x-secret-key');

  let credData: any = null;
  if (apiKey) {
    try {
      const { data } = await supabaseAdmin
        .from('b2b_api_credentials')
        .select('id, b2b_login_id, ip_whitelist, is_active')
        .eq('api_key', apiKey)
        .maybeSingle();
      credData = data;
    } catch (e) {
      console.error('[B2B Auth Middleware] Error querying creds:', e);
    }
  }

  const whitelist: string[] = credData?.ip_whitelist || [];
  const matchedIp = candidateIps.find(ip => whitelist.includes(ip));
  const effectiveIp = matchedIp || candidateIps[0] || '127.0.0.1';

  // Attach detected client IP for all downstream controllers
  (req as any).clientIp = effectiveIp;

  // Helper to record authentication failures in b2b_api_logs so admin can inspect live in Developer API Logs
  const logAuthFailure = async (statusCode: number, message: string, agentId?: string | null) => {
    try {
      await supabaseAdmin.from('b2b_api_logs').insert({
        agent_id: agentId || credData?.id || null,
        endpoint: req.originalUrl || req.path || '/api/b2b',
        request_ip: effectiveIp,
        request_payload: {
          method: req.method,
          headers: {
            'x-api-key': apiKey ? `${apiKey.substring(0, 8)}...` : undefined,
            'cf-connecting-ip': req.header('cf-connecting-ip'),
            'x-real-ip': req.header('x-real-ip'),
            'x-forwarded-for': req.header('x-forwarded-for'),
            'user-agent': req.header('user-agent'),
          },
          query: req.query,
          body: req.body || {}
        },
        response_payload: {
          status: 'error',
          message
        },
        status_code: statusCode,
        payment_status: 'auth_failed',
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.error('[B2B Auth Log Failure]', logErr);
    }
  };

  try {
    // 0. Check Global B2B Master API Toggle Status
    const { data: globalSettings } = await supabaseAdmin
      .from('b2b_settings')
      .select('is_api_enabled')
      .limit(1)
      .single();

    if (globalSettings && globalSettings.is_api_enabled === false) {
      const msg = 'B2B API service is currently disabled by Administrator.';
      await logAuthFailure(503, msg, credData?.id);
      return res.status(503).json({
        status: 'error',
        message: msg
      });
    }

    if (!apiKey || !secretKey) {
      const msg = 'Missing API Key or Secret Key in headers';
      await logAuthFailure(401, msg, credData?.id);
      return res.status(401).json({ status: 'error', message: msg });
    }

    // Call our Supabase Postgres function to authenticate
    const { data, error } = await supabaseAdmin.rpc('authenticate_b2b_api', {
      p_api_key: apiKey,
      p_secret_key: secretKey,
      p_ip_address: effectiveIp
    });

    if (error) {
      console.error('[B2B Auth Error]', error);
      const msg = error.message || 'Unauthorized Access';
      await logAuthFailure(401, msg, credData?.id);
      return res.status(401).json({ status: 'error', message: msg });
    }

    if (!data) {
      const msg = 'Invalid Credentials';
      await logAuthFailure(401, msg, credData?.id);
      return res.status(401).json({ status: 'error', message: msg });
    }

    // data is now a JSON object { agent_id, billavenue_agent_id }
    // Attach both to the request
    (req as any).agentId = data.agent_id;
    (req as any).billavenueAgentId = data.billavenue_agent_id || undefined;
    
    // Also save domain for logging if provided
    (req as any).requestDomain = req.get('origin') || req.hostname;

    next();
  } catch (err: any) {
    console.error('[B2B Middleware Exception]', err);
    await logAuthFailure(500, err.message || 'Internal Server Error during authentication', credData?.id);
    res.status(500).json({ status: 'error', message: 'Internal Server Error during authentication' });
  }
};
