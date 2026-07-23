import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { getBillers } from '../services/billavenue.js';
import WebSocket from 'ws';

(global as any).WebSocket = WebSocket;

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const billerIds = [
  "AUBA00000NAT3Q", "AXIS00000NATKF", "BAND00010NATWS", "BANK00000NATKB",
  "BANK00026NATRG", "CANA00000NATDO", "CSBO00026NATWL", "CUBC00000NATGR",
  "DBSB00000NATPR", "DCBB00017NATCL", "DHAN00000NAT6X", "EDGE00000NATWS",
  "ESAF00000NATPB", "FEDE00000NATDL", "HDFC00000NATBH", "HDFC00000NATW1",
  "HSBC00000NAT4M", "ICIC00000NATSI", "IDBI00000NAT7G", "IDFC00000NATFQ",
  "INDI00000NAT8I", "INDI00000NATFA", "INDU00000NATL1", "IOBC00000NATI3",
  "JAND00020NAT9D", "KOTA00000NATED", "ONEB00000NATS1", "PUNJ00000NATEY",
  "RBLB00000NATN3", "SARA00000NAT16", "SBIC00000NATDN", "SBMB00000NATX5",
  "SLIC00016NAT9L", "SOUT00000NAT68", "SURY00000NATNX", "TAMI00027NAT9C",
  "UNIO00000NATG9", "YESB00000NAT8U"
];

async function sync() {
  console.log(`Fetching MDM data for ${billerIds.length} billers in ONE API call...`);
  
  try {
    const response = await getBillers(billerIds);
    if (!response || !response.json || !response.json.billerInfoResponse) {
      console.log('Failed to fetch from BillAvenue:', response);
      return;
    }
    
    let billers = response.json.billerInfoResponse.biller;
    if (!Array.isArray(billers)) {
      billers = [billers];
    }
    
    console.log(`Received data for ${billers.length} billers. Saving to DB...`);
    
    let successCount = 0;
    for (const b of billers) {
      if (!b || !b.billerId) continue;
      b.mdm_fetched = true;
      const { error } = await supabase
        .from('billavenue_billers')
        .update({ metadata: b })
        .eq('biller_id', b.billerId);
        
      if (error) {
        console.error(`Error updating ${b.billerId}:`, error.message);
      } else {
        successCount++;
        console.log(`Updated ${b.billerId}`);
      }
    }
    
    console.log(`Successfully updated ${successCount} billers!`);
  } catch (err: any) {
    console.error('API Error:', err.message);
  }
}
sync();
