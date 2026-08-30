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
      .or('status_code.eq.202,payment_status.eq.pending')
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
      const bpr = log.response_payload?.billPayResponse || log.response_payload?.ExtBillPayResponse || log.response_payload;
      const cc01RefId = bpr?.txnRefId || bpr?.billerResponse?.txnRefId || log.request_payload?.billerResponseInfo?.txnRefId;
      const transactionId = log.request_payload?.transaction_id || log.response_payload?.transaction_id || log.id;

      // Strict rule: ONLY check status with BillAvenue CC01 Transaction Reference ID!
      if (!cc01RefId || !String(cc01RefId).startsWith('CC01')) {
        console.log(`[CRON] Skipping B2B log ID ${log.id} - Missing valid BillAvenue CC01 reference ID. Found: ${cc01RefId}`);
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

    // ==========================================
    // 3. Process Pending Records in `billavenue_transactions` Table Directly
    // ==========================================
    const { data: pendingBATxns, error: baError } = await supabaseAdmin
      .from('billavenue_transactions')
      .select('*')
      .eq('status', 'pending');

    if (baError) {
      console.error('[CRON] Error fetching pending billavenue_transactions:', baError);
    } else if (pendingBATxns && pendingBATxns.length > 0) {
      console.log(`[CRON] Found ${pendingBATxns.length} pending billavenue_transactions. Checking status...`);

      for (const baTxn of pendingBATxns) {
        const refId = baTxn.txn_ref_id || baTxn.request_id;
        if (!refId || refId === 'N/A') continue;

        const trackType = String(refId).startsWith('CC01') ? 'TRANS_REF_ID' : 'REQUEST_ID';
        try {
          console.log(`[CRON BA Table] Checking status for ${refId} (${trackType})...`);
          const statusResult = await getTransactionStatus(String(refId), trackType);

          const root = statusResult?.json?.transactionStatusResp || statusResult?.json?.transactionStatusResponse || statusResult?.json?.transactionStatusRes;
          if (root) {
            let txnStatus = '';
            let finalTxnRefId = baTxn.txn_ref_id || refId;

            if (root.responseCode !== '000') {
              txnStatus = 'failed';
            } else {
              const txnList = Array.isArray(root.txnList) ? root.txnList[0] : root.txnList;
              txnStatus = (txnList?.txnStatus || root.status || '').toLowerCase();
              finalTxnRefId = txnList?.txnReferenceId || root.txnRefId || finalTxnRefId;
            }

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
              console.log(`[CRON BA Table] Updating billavenue_transactions ID ${baTxn.id} to ${mappedStatus}`);

              // 1. Update billavenue_transactions table in Supabase DB
              await supabaseAdmin
                .from('billavenue_transactions')
                .update({
                  status: mappedStatus,
                  txn_ref_id: finalTxnRefId,
                  response: statusResult.json
                })
                .eq('id', baTxn.id);

              // 2. Update matching bbps_submissions table in Supabase DB
              const { data: matchedSubmissions } = await supabaseAdmin
                .from('bbps_submissions')
                .select('id, user_id, amount, charges, status, metadata')
                .or(`rejection_reason.eq.${refId},rejection_reason.eq.${finalTxnRefId},transaction_id.eq.${refId},metadata->>requestId.eq.${refId},metadata->>txnRefId.eq.${refId},metadata->>bConnectTxnId.eq.${refId}`);

              if (matchedSubmissions && matchedSubmissions.length > 0) {
                for (const sub of matchedSubmissions) {
                  await supabaseAdmin
                    .from('bbps_submissions')
                    .update({
                      status: mappedSubmissionStatus,
                      rejection_reason: finalTxnRefId
                    })
                    .eq('id', sub.id);

                  if (sub.status === 'pending' && mappedSubmissionStatus === 'rejected') {
                    const totalDeducted = sub.metadata?.totalDeducted || (Number(sub.amount) + Number(sub.charges || 0));
                    if (totalDeducted && typeof totalDeducted === 'number' && totalDeducted > 0) {
                      const { data: userProfile } = await supabaseAdmin
                        .from('users_profiles')
                        .select('wallet_balance')
                        .eq('id', sub.user_id)
                        .single();

                      if (userProfile) {
                        const refundedBalance = Number(userProfile.wallet_balance) + totalDeducted;
                        await supabaseAdmin
                          .from('users_profiles')
                          .update({ wallet_balance: refundedBalance })
                          .eq('id', sub.user_id);

                        console.log(`[CRON BA Table] Refunded ₹${totalDeducted} to user ${sub.user_id} for failed transaction ${refId}`);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(`[CRON BA Table] Error checking status for ${refId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[CRON] Global error in cron job:', err);
  }
});
