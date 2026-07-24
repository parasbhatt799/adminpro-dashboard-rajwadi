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
  const { data } = await supabase.from('billavenue_billers').select('biller_id, biller_name, metadata').ilike('biller_name', '%Tamilnad%').limit(1);
  if (!data || data.length === 0) {
    console.log('No biller found.');
    return;
  }
  const billerId = data[0].biller_id;
  console.log(`Found biller: ${data[0].biller_name} (${billerId})`);
  console.log('Current DB metadata:', JSON.stringify(data[0].metadata, null, 2));

  console.log(`Fetching from API for ${billerId}...`);
  try {
    const response = await getBillers(billerId);
    console.log('API Response:', JSON.stringify(response, null, 2));
  } catch (err: any) {
    console.error('API Error:', err.message);
  }
}
test();
