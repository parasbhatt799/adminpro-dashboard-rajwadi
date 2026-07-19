import * as dotenv from 'dotenv';
dotenv.config();

import { callBillAvenueApi } from './services/billavenue.ts';

async function test() {
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><billerInfoRequest></billerInfoRequest>`;
    const response = await callBillAvenueApi('https://stgapi.billavenue.com/extMdmCntrl/mdmRequestNew/xml', xml);
    
    if (response.json && response.json.billerInfoResponse && response.json.billerInfoResponse.biller) {
      const billers = Array.isArray(response.json.billerInfoResponse.biller) ? response.json.billerInfoResponse.biller : [response.json.billerInfoResponse.biller];
      
      const kotak = billers.find((b: any) => b.billerName && b.billerName.toLowerCase().includes('kotak'));
      console.log('Kotak Biller in massive list:', JSON.stringify(kotak, null, 2));
      
      const rbl = billers.find((b: any) => b.billerName && b.billerName.toLowerCase().includes('rbl'));
      console.log('RBL Biller in massive list:', JSON.stringify(rbl, null, 2));
    }
  } catch (err) {
    console.error(err);
  }
}

test();
