import cron from 'node-cron';
import { supabaseAdmin } from '../server.js';
import { getTransactionStatus } from '../services/billavenue';
import fetch from 'node-fetch';

console.log('[CRON] Starting BillAvenue asynchronous status polling job...');

// Run every 10 minutes: '*/10 * * * *'
// You can adjust this to your needs
cron.schedule('*/10 * * * *', async () => {
  console.log('[CRON] Running pending transactions check...');
  try {
    // 1. Find all pending transactions older than 15 minutes
    // Current time minus 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: pendingLogs, error: logError } = await supabaseAdmin
      .from('b2b_api_logs')
      .select('*')
      .eq('payment_status', 'pending')
      .lt('created_at', fifteenMinutesAgo);

    if (logError) {
      console.error('[CRON] Error fetching pending logs:', logError);
      return;
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      console.log('[CRON] No pending transactions found older than 15 minutes.');
      return;
    }

    console.log(`[CRON] Found ${pendingLogs.length} pending transactions. Checking status...`);

    for (const log of pendingLogs) {
      const transactionId = log.request_payload?.transaction_id || log.request_payload?.requestId;
      if (!transactionId) continue;

      try {
        console.log(`[CRON] Checking status for transaction ID: ${transactionId}`);
        const statusResult = await getTransactionStatus(transactionId);
        
        let newStatus = 'pending';
        let bbpsStatus = '';

        if (statusResult?.json?.transactionStatusRes) {
           bbpsStatus = statusResult.json.transactionStatusRes.txnStatus?.toUpperCase() || '';
           if (bbpsStatus === 'SUCCESS') {
             newStatus = 'success';
           } else if (bbpsStatus === 'FAILED' || bbpsStatus === 'FAILURE') {
             newStatus = 'failed';
           }
        }

        if (newStatus !== 'pending') {
          console.log(`[CRON] Transaction ${transactionId} status changed to ${newStatus}`);
          
          // Update the b2b_api_logs record
          await supabaseAdmin
            .from('b2b_api_logs')
            .update({ payment_status: newStatus })
            .eq('id', log.id);

          // If failed, refund the wallet
          if (newStatus === 'failed') {
            const refundAmount = log.request_payload?.totalDeduction || 0;
            if (refundAmount > 0) {
              await supabaseAdmin.rpc('add_b2b_wallet_balance', {
                p_agent_id: log.agent_id,
                p_amount: refundAmount
              });
              console.log(`[CRON] Refunded ₹${refundAmount} to agent ${log.agent_id} for failed transaction ${transactionId}`);
            }
          }

          // Trigger Webhook
          const { data: creds } = await supabaseAdmin
            .from('b2b_api_credentials')
            .select('webhook_url')
            .eq('agent_id', log.agent_id)
            .single();

          if (creds?.webhook_url && creds.webhook_url.startsWith('http')) {
             const webhookPayload = {
               event: 'PAYMENT_STATUS_UPDATE',
               transaction_id: transactionId,
               status: newStatus,
               amount: log.request_payload?.amount || 0,
               bbps_status: bbpsStatus,
               timestamp: new Date().toISOString()
             };
             
             try {
                console.log(`[CRON] Firing webhook for agent ${log.agent_id} at ${creds.webhook_url}`);
                const webhookRes = await fetch(creds.webhook_url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(webhookPayload)
                });
                
                const responseBody = await webhookRes.text();
                
                // Log webhook success
                await supabaseAdmin.from('b2b_webhook_logs').insert({
                  agent_id: log.agent_id,
                  transaction_id: transactionId,
                  webhook_url: creds.webhook_url,
                  payload: webhookPayload,
                  response_status: webhookRes.status,
                  response_body: responseBody
                });
                
             } catch (webhookError: any) {
                console.error(`[CRON] Webhook failed for agent ${log.agent_id}:`, webhookError);
                
                // Log webhook failure
                await supabaseAdmin.from('b2b_webhook_logs').insert({
                  agent_id: log.agent_id,
                  transaction_id: transactionId,
                  webhook_url: creds.webhook_url,
                  payload: webhookPayload,
                  error_message: webhookError.message
                });
             }
          }
        }
      } catch (err) {
        console.error(`[CRON] Error processing transaction ${transactionId}:`, err);
      }
    }
  } catch (err) {
    console.error('[CRON] Global error in cron job:', err);
  }
});
