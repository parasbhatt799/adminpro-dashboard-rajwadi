import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../server'; // Assume server exports supabaseAdmin or we recreate it

export const b2bAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.header('x-api-key');
    const secretKey = req.header('x-secret-key');
    // x-forwarded-for for proxies, or req.ip
    const ipAddress = req.header('x-forwarded-for')?.split(',')[0] || req.ip || req.socket.remoteAddress;

    if (!apiKey || !secretKey) {
      return res.status(401).json({ status: 'error', message: 'Missing API Key or Secret Key in headers' });
    }

    // Call our Supabase Postgres function to authenticate
    const { data, error } = await supabaseAdmin.rpc('authenticate_b2b_api', {
      p_api_key: apiKey,
      p_secret_key: secretKey,
      p_ip_address: ipAddress
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
