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
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingLogs, error: logError } = await supabaseAdmin
      .from('b2b_api_logs')
      .select('*')
      .or('status_code.eq.202,payment_status.eq.pending,payment_status.eq.failed')
      .gte('created_at', sevenDaysAgo)
      .lt('created_at', fifteenMinutesAgo)
      .limit(100);

    if (logError) {
      console.error('[CRON] Error fetching pending logs:', logError);
      return;
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      console.log('[CRON] No pending or failed transactions found older than 15 minutes.');
      return;
    }

    console.log(`[CRON] Found ${pendingLogs.length} pending/failed transactions with possible BillAvenue status. Checking...`);

    for (const log of pendingLogs) {
      const bpr = log.response_payload?.billPayResponse || log.response_payload?.ExtBillPayResponse || log.response_payload;
      const cc01RefId = bpr?.txnRefId || bpr?.billerResponse?.txnRefId || log.request_payload?.billerResponseInfo?.txnRefId;
      const transactionId = log.request_payload?.transaction_id || log.response_payload?.transaction_id || log.id;

      // Strict rule: ONLY check status with BillAvenue CC01 Transaction Reference ID!
      if (!cc01RefId || !String(cc01RefId).startsWith('CC01')) {
        continue;
      }

      try {
        const trackType = 'TRANS_REF_ID';
        console.log(`[CRON] Checking status for B2B transaction via CC01 ID: ${cc01RefId}`);
        const statusResult = await getTransactionStatus(String(cc01RefId), trackType);

        let newStatus = 'pending';
        let bbpsStatus = '';

        if (statusResult?.json) {
          const root = statusResult.json.transactionStatusResp || statusResult.json.transactionStatusRes || statusResult.json.transactionStatusResponse;
          if (root) {
            if (root.responseCode !== '000') {
              console.log(`[CRON] BillAvenue returned non-000 code (${root.responseCode}) for B2B txn ${transactionId}. Keeping status as pending.`);
            } else {
              const txnList = Array.isArray(root.txnList) ? root.txnList[0] : root.txnList;
              bbpsStatus = txnList?.txnStatus?.toUpperCase() || '';
            }

            if (bbpsStatus === 'SUCCESS' || bbpsStatus === 'APPROVED') {
              newStatus = 'success';
            } else if (bbpsStatus === 'FAILED' || bbpsStatus === 'FAILURE' || bbpsStatus === 'REJECTED') {
              newStatus = 'failed';
            }
          }
        }

        if (newStatus !== 'pending' && newStatus !== log.payment_status) {
          console.log(`[CRON] Transaction ${transactionId} status changed from ${log.payment_status || 'pending'} to ${newStatus}`);

          // Use atomic RPC function to handle DB update, wallet balance deduction/refund & admin profit
          const { data: updateRes, error: updateErr } = await supabaseAdmin.rpc('admin_update_b2b_bill_status', {
            p_log_id: log.id,
            p_status: newStatus
          });

          if (updateErr) {
            console.error(`[CRON] Error calling admin_update_b2b_bill_status for ${transactionId}:`, updateErr);
          } else {
            console.log(`[CRON] Wallet & DB updated successfully for ${transactionId}:`, updateRes?.message || 'Updated');
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
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: b2cPendingLogs, error: b2cError } = await supabaseAdmin
      .from('bbps_submissions')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', fortyEightHoursAgo)
      .lt('created_at', fiveMinutesAgo)
      .limit(100);

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

        const trackType = 'TRANS_REF_ID';

        try {
          console.log(`-> Checking B2C status via API with ${trackType}: ${referenceId}`);
          const statusResult = await getTransactionStatus(String(referenceId), trackType);
          console.log(`-> API Response received for ${referenceId}. Parsing status...`);

          const root = statusResult?.json?.transactionStatusResp || statusResult?.json?.transactionStatusResponse || statusResult?.json?.transactionStatusRes;

          if (root) {
            let txnStatus = '';
            let txnReferenceId = referenceId;

            if (root.responseCode !== '000') {
              txnStatus = 'failed';
            } else {
              const txnList = Array.isArray(root.txnList) ? root.txnList[0] : root.txnList;
              txnStatus = txnList?.txnStatus?.toLowerCase() || '';
              txnReferenceId = txnList?.txnReferenceId || referenceId;
            }

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
                  rejection_reason: txnReferenceId
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
