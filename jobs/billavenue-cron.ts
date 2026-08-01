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
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: b2cPendingLogs, error: b2cError } = await supabaseAdmin
      .from('bbps_submissions')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', fiveMinutesAgo);

    if (b2cError) {
      console.error('[CRON] Error fetching B2C pending transactions:', b2cError);
    } else if (b2cPendingLogs && b2cPendingLogs.length > 0) {
      console.log(`[CRON] Found ${b2cPendingLogs.length} B2C pending transactions. Analyzing...`);
      
      for (const log of b2cPendingLogs) {
        console.log(`\n--- [CRON B2C] Analyzing Pending ID: ${log.id} ---`);
        console.log(`Amount: ${log.amount}, Provider: ${log.provider}, Service: ${log.service_type}`);
        console.log(`Metadata:`, JSON.stringify(log.metadata || {}));
        console.log(`Rejection Reason (Txn Ref):`, log.rejection_reason);

        // Identify if it's BillAvenue by checking if the reference ID starts with CC01
        // (User confirmed BillAvenue IDs always start with CC01)
        const referenceId = log.rejection_reason || log.metadata?.requestId;
        
        if (!referenceId || !String(referenceId).startsWith('CC01')) {
           console.log(`-> Skipping ID ${log.id} - Not a BillAvenue transaction (ID does not start with CC01). Found: ${referenceId}`);
           continue;
        }
        
        const trackType = 'TXN_REF_ID';

        try {
          console.log(`-> Checking B2C status via API with ${trackType}: ${referenceId}`);
          const statusResult = await getTransactionStatus(String(referenceId), trackType);
          console.log(`-> API Response received for ${referenceId}. Parsing status...`);
          
          const statusResponse = statusResult?.json?.transactionStatusResp || statusResult?.json?.transactionStatusResponse || statusResult?.json?.billPayResponse;
          
          if (statusResponse) {
            const txnStatus = statusResponse.status?.toLowerCase() || statusResponse.txnStatus?.toLowerCase();
            console.log(`-> Parsed status from API: ${txnStatus}`);
            
            let mappedStatus: 'success' | 'failed' | 'pending' = 'pending';
            let mappedSubmissionStatus = 'pending';
            
            if (txnStatus === 'success' || txnStatus === 'approved') {
              mappedStatus = 'success';
              mappedSubmissionStatus = 'approved';
            } else if (txnStatus === 'failed' || txnStatus === 'failure' || txnStatus === 'rejected') {
              mappedStatus = 'failed';
              mappedSubmissionStatus = 'rejected';
            }

            if (mappedStatus !== 'pending') {
              console.log(`-> Updating B2C Transaction ${referenceId} in DB to ${mappedStatus}`);

              // Update bbps_submissions and handle refund
              await supabaseAdmin
                .from("bbps_submissions")
                .update({
                  status: mappedSubmissionStatus,
                  rejection_reason: statusResponse.txnRefId || requestId
                })
                .eq("id", log.id);

              // Refund Logic if Failed
              if (mappedSubmissionStatus === 'rejected') {
                const totalDeducted = log.metadata?.totalDeducted || (Number(log.amount) + Number(log.charges));
                if (totalDeducted && typeof totalDeducted === 'number' && !isNaN(totalDeducted)) {
                  const { data: userProfile } = await supabaseAdmin
                    .from("users_profiles")
                    .select("wallet_balance")
                    .eq("id", log.user_id)
                    .single();
                  
                  if (userProfile) {
                    const refundedBalance = Number(userProfile.wallet_balance) + totalDeducted;
                    await supabaseAdmin
                      .from("users_profiles")
                      .update({ wallet_balance: refundedBalance })
                      .eq("id", log.user_id);
                      
                    console.log(`[CRON] Refunded ₹${totalDeducted} to user ${log.user_id} for failed B2C transaction ${referenceId}`);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(`[CRON] Error processing B2C transaction ${referenceId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[CRON] Global error in cron job:', err);
  }
});
