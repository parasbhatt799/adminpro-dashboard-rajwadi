import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkLogs() {
  let allLogs: any[] = [];
  let from = 0;
  let step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('b2b_api_logs')
      .select('charge_deducted, request_payload, response_payload, status_code, endpoint, created_at')
      .or("endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill")
      .range(from, from + step - 1);

    if (error) {
      console.error('Error:', error);
      break;
    }

    if (data && data.length > 0) {
      allLogs = allLogs.concat(data);
      if (data.length < step) hasMore = false;
      else from += step;
    } else {
      hasMore = false;
    }
  }

  console.log('TOTAL PAY LOGS FETCHED:', allLogs.length);

  let successCount = 0;
  let totalEarningsSum = 0;

  allLogs.forEach((log) => {
    const req = log.request_payload || {};
    const res = log.response_payload || {};
    
    const isSuccess = log.status_code === 200 && (
      res?.payment_status === 'success' || 
      res?.finalStatus === 'success' || 
      res?.status === 'success' ||
      res?.responseCode === '000' || 
      res?.billPayResponse?.responseCode === '000' ||
      res?.ExtBillPayResponse?.responseCode === '000' ||
      res?.billPayResponse?.responseReason?.toLowerCase() === 'successful' ||
      res?.ExtBillPayResponse?.responseReason?.toLowerCase() === 'successful'
    );

    if (isSuccess) {
      successCount++;
      const chargeVal = Number(
        (log as any).charge_deducted ?? 
        req?.chargeDeducted ?? 
        req?.chargePerBill ?? 
        req?.charge ?? 
        (req?.totalDeduction && req?.amount ? req.totalDeduction - req.amount : undefined) ?? 
        0
      );
      totalEarningsSum += chargeVal;
    }
  });

  console.log('SUCCESS COUNT:', successCount);
  console.log('TOTAL API EARNINGS SUM:', totalEarningsSum);
}

checkLogs();
