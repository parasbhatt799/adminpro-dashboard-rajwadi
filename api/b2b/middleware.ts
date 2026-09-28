import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../server'; // Assume server exports supabaseAdmin or we recreate it

export const b2bAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 0. Check Global B2B Master API Toggle Status
    const { data: globalSettings } = await supabaseAdmin
      .from('b2b_settings')
      .select('is_api_enabled')
      .limit(1)
      .single();

    if (globalSettings && globalSettings.is_api_enabled === false) {
      return res.status(503).json({
        status: 'error',
        message: 'B2B API service is currently disabled by Administrator.'
      });
    }

    const apiKey = req.header('x-api-key');
    const secretKey = req.header('x-secret-key');

    if (!apiKey || !secretKey) {
      return res.status(401).json({ status: 'error', message: 'Missing API Key or Secret Key in headers' });
    }

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

    // Fetch agent's whitelist from DB to match real client IP
    const { data: credData } = await supabaseAdmin
      .from('b2b_api_credentials')
      .select('ip_whitelist')
      .eq('api_key', apiKey)
      .maybeSingle();

    const whitelist: string[] = credData?.ip_whitelist || [];

    // Prioritize candidate IP that matches agent's whitelist; otherwise fallback to primary detected client IP
    const matchedIp = candidateIps.find(ip => whitelist.includes(ip));
    const effectiveIp = matchedIp || candidateIps[0] || '127.0.0.1';

    // Call our Supabase Postgres function to authenticate
    const { data, error } = await supabaseAdmin.rpc('authenticate_b2b_api', {
      p_api_key: apiKey,
      p_secret_key: secretKey,
      p_ip_address: effectiveIp
    });

    if (error) {
      console.error('[B2B Auth Error]', error);
      return res.status(401).json({ status: 'error', message: error.message || 'Unauthorized Access' });
    }

    if (!data) {
      return res.status(401).json({ status: 'error', message: 'Invalid Credentials' });
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
    res.status(500).json({ status: 'error', message: 'Internal Server Error during authentication' });
  }
};
