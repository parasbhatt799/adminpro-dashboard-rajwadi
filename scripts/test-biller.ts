import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { getBillers } from '../services/billavenue.js';
import WebSocket from 'ws';

(global as any).WebSocket = WebSocket;

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const billerId = 'SBIC00000NATDN';
  console.log(`Fetching from API for ${billerId}...`);
  try {
    const response = await getBillers(billerId);
    console.log('API Response:', JSON.stringify(response, null, 2));
  } catch (err: any) {
    console.error('API Error:', err.message);
  }
}
test();
