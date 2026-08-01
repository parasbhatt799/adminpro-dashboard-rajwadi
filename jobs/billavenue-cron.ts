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
          
          // Determine status code and charge
          let newStatusCode = 200; // Success code by default
          let chargeDeducted = log.request_payload?.chargeDeducted || 0;
          let updatedPayload = log.response_payload || {};
          
          updatedPayload = { ...updatedPayload, finalStatus: newStatus, payment_status: newStatus };

          if (newStatus === 'failed') {
            newStatusCode = 500;
          }

          // Update the b2b_api_logs record
          await supabaseAdmin
            .from('b2b_api_logs')
            .update({ 
              payment_status: newStatus,
              status_code: newStatusCode,
              charge_deducted: newStatus === 'success' ? chargeDeducted : 0,
              response_payload: updatedPayload
            })
            .eq('id', log.id);

          // Handle Wallets & Profits
          if (newStatus === 'failed') {
            const refundAmount = log.request_payload?.totalDeduction || 0;
            if (refundAmount > 0) {
              await supabaseAdmin.rpc('add_b2b_wallet_balance', {
                p_agent_id: log.agent_id,
                p_amount: refundAmount
              });
              console.log(`[CRON] Refunded ₹${refundAmount} to agent ${log.agent_id} for failed transaction ${transactionId}`);
            }
          } else if (newStatus === 'success') {
            if (chargeDeducted > 0) {
              await supabaseAdmin.rpc('add_admin_balance', { p_amount: chargeDeducted });
              console.log(`[CRON] Credited ₹${chargeDeducted} to admin balance for successful transaction ${transactionId}`);
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

    // ==========================================
    // 2. Process B2C Transactions (Main App)
    // ==========================================
    const { data: b2cPendingLogs, error: b2cError } = await supabaseAdmin
      .from('billavenue_transactions')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', fifteenMinutesAgo);

    if (b2cError) {
      console.error('[CRON] Error fetching B2C pending transactions:', b2cError);
    } else if (b2cPendingLogs && b2cPendingLogs.length > 0) {
      console.log(`[CRON] Found ${b2cPendingLogs.length} B2C pending transactions. Checking status...`);
      
      for (const log of b2cPendingLogs) {
        const requestId = log.request_id;
        if (!requestId) continue;

        try {
          console.log(`[CRON] Checking B2C status for request ID: ${requestId}`);
          const statusResult = await getTransactionStatus(requestId, 'REQUEST_ID');
          const statusResponse = statusResult?.json?.transactionStatusResp || statusResult?.json?.transactionStatusResponse;
          
          if (statusResponse) {
            const txnStatus = statusResponse.status?.toLowerCase();
            let mappedStatus: 'success' | 'failed' | 'pending' = 'pending';
            let mappedSubmissionStatus = 'pending';
            
            if (txnStatus === 'success' || txnStatus === 'approved') {
              mappedStatus = 'success';
              mappedSubmissionStatus = 'approved';
            } else if (txnStatus === 'failed' || txnStatus === 'rejected') {
              mappedStatus = 'failed';
              mappedSubmissionStatus = 'rejected';
            }

            if (mappedStatus !== 'pending') {
              console.log(`[CRON] B2C Transaction ${requestId} status changed to ${mappedStatus}`);

              // Update the billavenue_transactions record
              await supabaseAdmin
                .from('billavenue_transactions')
                .update({
                  txn_ref_id: statusResponse.txnRefId,
                  status: mappedStatus,
                  response: statusResult.json
                })
                .eq('request_id', requestId);

              // Update bbps_submissions and handle refund
              const { data: existingSubmission } = await supabaseAdmin
                .from("bbps_submissions")
                .select("id, status, user_id, metadata")
                .eq("metadata->>requestId", requestId)
                .maybeSingle();

              if (existingSubmission) {
                await supabaseAdmin
                  .from("bbps_submissions")
                  .update({
                    status: mappedSubmissionStatus,
                    rejection_reason: statusResponse.txnRefId || requestId
                  })
                  .eq("id", existingSubmission.id);

                // Refund Logic if Failed
                if (existingSubmission.status === 'pending' && mappedSubmissionStatus === 'rejected') {
                  const totalDeducted = existingSubmission.metadata?.totalDeducted;
                  if (totalDeducted && typeof totalDeducted === 'number') {
                    const { data: userProfile } = await supabaseAdmin
                      .from("users_profiles")
                      .select("wallet_balance")
                      .eq("id", existingSubmission.user_id)
                      .single();
                    
                    if (userProfile) {
                      const refundedBalance = Number(userProfile.wallet_balance) + totalDeducted;
                      await supabaseAdmin
                        .from("users_profiles")
                        .update({ wallet_balance: refundedBalance })
                        .eq("id", existingSubmission.user_id);
                        
                      console.log(`[CRON] Refunded ₹${totalDeducted} to user ${existingSubmission.user_id} for failed B2C transaction ${requestId}`);
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(`[CRON] Error processing B2C transaction ${requestId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[CRON] Global error in cron job:', err);
  }
});
