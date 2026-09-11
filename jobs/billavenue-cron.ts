import cron from 'node-cron';
import { supabaseAdmin } from '../server.js';
import { getTransactionStatus } from '../services/billavenue';
import fetch from 'node-fetch';

console.log('[CRON] Starting BillAvenue asynchronous status polling job...');

// Run every 5 hours (around 5 times in 24 hours): '0 */5 * * *'
cron.schedule('0 */5 * * *', async () => {
  console.log('[CRON] Running pending & failed transactions check (every 5 hours, last 24h)...');
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingLogs, error: logError } = await supabaseAdmin
      .from('b2b_api_logs')
      .select('*')
      .or('status_code.eq.202,payment_status.eq.pending,payment_status.eq.failed')
      .gte('created_at', twentyFourHoursAgo)
      .lt('created_at', fifteenMinutesAgo)
      .limit(100);

    if (logError) {
      console.error('[CRON] Error fetching pending logs:', logError);
      return;
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      console.log('[CRON] No pending or failed transactions found in last 24h (older than 15 min).');
      return;
    }

    console.log(`[CRON] Found ${pendingLogs.length} pending/failed transactions with possible BillAvenue status. Checking...`);

    for (const log of pendingLogs) {
      const bpr = log.response_payload?.billPayResponse || log.response_payload?.ExtBillPayResponse || log.response_payload;
      const cc01RefId = bpr?.txnRefId || bpr?.billerResponse?.txnRefId || log.request_payload?.billerResponseInfo?.txnRefId;
      const transactionId = log.request_payload?.transaction_id || log.response_payload?.transaction_id || log.id;

      // 1. Check with CC01 TRANS_REF_ID if available, else fallback to REQUEST_ID
      const requestIdCandidate = log.request_payload?.fetchRequestId
        || log.request_payload?.billavenue_request_id
        || log.request_payload?.requestId
        || log.response_payload?.requestId
        || log.request_payload?.payRequestId
        || log.response_payload?.payRequestId;

      let trackType = '';
      let trackValue = '';

      if (cc01RefId && String(cc01RefId).startsWith('CC01')) {
        trackType = 'TRANS_REF_ID';
        trackValue = String(cc01RefId);
      } else if (requestIdCandidate) {
        trackType = 'REQUEST_ID';
        trackValue = String(requestIdCandidate);
      } else {
        console.log(`[CRON] Skipping B2B txn ${transactionId}: Neither CC01 Ref ID nor Request ID found.`);
        continue;
      }

      try {
        console.log(`[CRON] Checking status for B2B transaction ${transactionId} via ${trackType}: ${trackValue}`);
        const statusResult = await getTransactionStatus(trackValue, trackType);

        let newStatus = 'pending';
        let bbpsStatus = '';
        let billAvenueTxnData: any = null;

        if (statusResult?.json) {
          const root = statusResult.json.transactionStatusResp || statusResult.json.transactionStatusRes || statusResult.json.transactionStatusResponse;
          if (root) {
            if (root.responseCode === '205') {
              console.log(`[CRON] BillAvenue returned code 205 (No Txn mapped against ${trackType}) for ${transactionId}. Marking as failed.`);
              bbpsStatus = 'FAILED';
              newStatus = 'failed';
            } else if (root.responseCode !== '000') {
              console.log(`[CRON] BillAvenue returned non-000 code (${root.responseCode}) for B2B txn ${transactionId}. Keeping status as pending.`);
            } else {
              const txnList = Array.isArray(root.txnList) ? root.txnList[0] : root.txnList;
              billAvenueTxnData = txnList;
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

          // Enforce saving the FULL BillAvenue response into response_payload
          const root = statusResult?.json?.transactionStatusResp || statusResult?.json?.transactionStatusRes || statusResult?.json?.transactionStatusResponse || {};
          const existingPayload = log.response_payload || {};
          const reqPayload = log.request_payload || {};

          let apiTxnId = existingPayload?.api_txn_id || reqPayload?.api_txn_id;
          if (!apiTxnId) {
            if (typeof existingPayload?.transaction_id === 'string' && existingPayload.transaction_id.startsWith('BBPSU')) {
              apiTxnId = existingPayload.transaction_id;
            } else if (typeof reqPayload?.transaction_id === 'string' && reqPayload.transaction_id.startsWith('BBPSU')) {
              apiTxnId = reqPayload.transaction_id;
            } else {
              apiTxnId = `BBPSU${Math.floor(1000000000 + Math.random() * 9000000000)}`;
            }
          }
          const clientTxnId = reqPayload?.client_transaction_id 
            || (String(transactionId).startsWith('BBPSU') ? (reqPayload?.transaction_id || apiTxnId) : transactionId);

          const cc01Ref = billAvenueTxnData?.txnReferenceId 
            || billAvenueTxnData?.txnRefId 
            || existingPayload?.ExtBillPayResponse?.txnRefId 
            || existingPayload?.billPayResponse?.txnRefId 
            || (typeof existingPayload?.txnRefId === 'string' && existingPayload.txnRefId.startsWith('CC01') ? existingPayload.txnRefId : undefined);

          const extBillPayResponse: any = {
            ...(existingPayload.ExtBillPayResponse || existingPayload.billPayResponse || {}),
            ...(billAvenueTxnData || {}),
            txnRefId: cc01Ref || undefined,
            responseCode: root.responseCode || (newStatus === 'success' ? '000' : '999'),
            responseReason: root.responseReason || (newStatus === 'success' ? 'Successful' : 'Failure'),
            approvalRefNumber: billAvenueTxnData?.approvalRefNumber || existingPayload?.ExtBillPayResponse?.approvalRefNumber || undefined,
            RespAmount: billAvenueTxnData?.amount ? String(Math.round(Number(billAvenueTxnData.amount) * 100)) : (existingPayload?.ExtBillPayResponse?.RespAmount || undefined),
            CustConvFee: billAvenueTxnData?.custConvFee || existingPayload?.ExtBillPayResponse?.CustConvFee || '0',
            RespCustomerName: billAvenueTxnData?.respCustomerName || reqPayload?.billerResponseInfo?.customerName || existingPayload?.ExtBillPayResponse?.RespCustomerName || undefined,
            txnRespType: billAvenueTxnData?.txnRespType || existingPayload?.ExtBillPayResponse?.txnRespType || 'FORWARD TYPE RESPONSE'
          };

          if (billAvenueTxnData?.inputList && !extBillPayResponse.inputParams) {
            extBillPayResponse.inputParams = { input: billAvenueTxnData.inputList };
          }

          const mergedPayload = {
            ...existingPayload,
            payment_status: newStatus,
            finalStatus: newStatus,
            transaction_id: apiTxnId,
            api_txn_id: apiTxnId,
            client_transaction_id: clientTxnId,
            bbps_txn_ref_id: apiTxnId,
            ExtBillPayResponse: extBillPayResponse,
            billPayResponse: extBillPayResponse,
            statusCheckDetails: {
              checked_at: new Date().toISOString(),
              trackType,
              trackValue,
              bbpsStatus
            },
            updated_via: `CRON_${trackType}_STATUS_CHECK`
          };

          await supabaseAdmin
            .from('b2b_api_logs')
            .update({
              payment_status: newStatus,
              status_code: newStatus === 'success' ? 200 : 500,
              response_payload: mergedPayload
            })
            .eq('id', log.id);

          // Trigger Webhook
          const { data: creds } = await supabaseAdmin
            .from('b2b_api_credentials')
            .select('webhook_url')
            .eq('agent_id', log.agent_id)
            .single();

          if (creds?.webhook_url && creds.webhook_url.startsWith('http')) {
            const webhookPayload = {
              event: 'PAYMENT_STATUS_UPDATE',
              transaction_id: apiTxnId,
              api_txn_id: apiTxnId,
              client_transaction_id: clientTxnId,
              bbps_txn_ref_id: apiTxnId, // NOTE: Send BBPSU... ID, do NOT expose CC01 to B2B agent
              status: newStatus,
              amount: log.request_payload?.amount || 0,
              bbps_status: bbpsStatus,
              approval_ref_number: billAvenueTxnData?.approvalRefNumber || undefined,
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
                transaction_id: apiTxnId,
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
                transaction_id: apiTxnId,
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

        // Identify if it's BillAvenue by checking CC01 or Request ID
        const referenceId = log.rejection_reason || log.metadata?.requestId;
        const b2cReqId = log.metadata?.fetchRequestId || log.metadata?.requestId;

        let trackType = 'TRANS_REF_ID';
        let trackValue = '';

        if (referenceId && String(referenceId).startsWith('CC01')) {
          trackType = 'TRANS_REF_ID';
          trackValue = String(referenceId);
        } else if (b2cReqId) {
          trackType = 'REQUEST_ID';
          trackValue = String(b2cReqId);
        } else {
          console.log(`-> Skipping ID ${log.id} - Neither CC01 Ref ID nor Request ID found.`);
          continue;
        }

        try {
          console.log(`-> Checking B2C status via API with ${trackType}: ${trackValue}`);
          const statusResult = await getTransactionStatus(trackValue, trackType);
          console.log(`-> API Response received for ${trackValue}. Parsing status...`);

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
