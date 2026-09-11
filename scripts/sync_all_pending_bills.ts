import { createClient } from '@supabase/supabase-js';
import * as billAvenue from '../services/billavenue.js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://malrqshegrrovyrhflup.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('====================================================');
  console.log('Starting Batch Sync for All Pending & Failed B2B Bills');
  console.log('====================================================\n');

  // Fetch all pending logs (and failed if desired)
  const { data: logs, error } = await supabaseAdmin
    .from('b2b_api_logs')
    .select('*')
    .or('endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill')
    .eq('payment_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  console.log(`Found ${logs?.length || 0} pending transactions to check.\n`);
  if (!logs || logs.length === 0) {
    console.log('No pending transactions found.');
    return;
  }

  let successCount = 0;
  let failedCount = 0;
  let stillPendingCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const bpr = log.response_payload?.billPayResponse || log.response_payload?.ExtBillPayResponse || log.response_payload;
    const cc01RefId = bpr?.txnRefId || bpr?.billerResponse?.txnRefId || log.request_payload?.billerResponseInfo?.txnRefId;
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
    }

    const txnId = log.request_payload?.transaction_id || log.response_payload?.transaction_id || log.id;

    if (!trackValue) {
      console.log(`[${i + 1}/${logs.length}] SKIPPED: Txn ${txnId} (Neither CC01 nor Request ID found)`);
      skippedCount++;
      continue;
    }

    try {
      process.stdout.write(`[${i + 1}/${logs.length}] Checking Txn ${txnId} (${trackType}: ${trackValue})... `);
      const statusResult = await billAvenue.getTransactionStatus(trackValue, trackType);

      let bbpsStatus = 'UNKNOWN';
      let billAvenueTxnData: any = null;
      let root: any = null;
      if (statusResult?.json) {
        root = statusResult.json.transactionStatusResp || statusResult.json.transactionStatusRes || statusResult.json.transactionStatusResponse;
        if (root) {
          if (root.responseCode === '205') {
            bbpsStatus = 'FAILED';
          } else if (root.responseCode !== '000') {
            bbpsStatus = 'PENDING';
          } else {
            const txnList = Array.isArray(root.txnList) ? root.txnList[0] : root.txnList;
            billAvenueTxnData = txnList;
            bbpsStatus = txnList?.txnStatus?.toUpperCase() || 'UNKNOWN';
          }
        }
      }

      let newStatus = log.payment_status || 'pending';
      if (bbpsStatus === 'SUCCESS' || bbpsStatus === 'APPROVED') {
        console.log(`-> SUCCESS! Updating in DB...`);
        await supabaseAdmin.rpc('admin_update_b2b_bill_status', {
          p_log_id: log.id,
          p_status: 'success'
        });
        newStatus = 'success';
        successCount++;
      } else if (bbpsStatus === 'FAILED' || bbpsStatus === 'FAILURE' || bbpsStatus === 'REJECTED') {
        console.log(`-> FAILED! Marking failed & refunding agent...`);
        await supabaseAdmin.rpc('admin_update_b2b_bill_status', {
          p_log_id: log.id,
          p_status: 'failed'
        });
        newStatus = 'failed';
        failedCount++;
      } else {
        console.log(`-> Still ${bbpsStatus}`);
        stillPendingCount++;
      }

      // Always merge and persist the FULL gateway response into response_payload
      const existingPayload = log.response_payload || {};
      const reqPayload = log.request_payload || {};
      const cc01Ref = billAvenueTxnData?.txnReferenceId 
        || billAvenueTxnData?.txnRefId 
        || existingPayload?.ExtBillPayResponse?.txnRefId 
        || existingPayload?.billPayResponse?.txnRefId 
        || (typeof existingPayload?.txnRefId === 'string' && existingPayload.txnRefId.startsWith('CC01') ? existingPayload.txnRefId : undefined);

      let apiTxnId = existingPayload?.api_txn_id 
        || reqPayload?.api_txn_id 
        || (typeof existingPayload?.transaction_id === 'string' && existingPayload.transaction_id.startsWith('BBPSU') ? existingPayload.transaction_id : null) 
        || (typeof reqPayload?.transaction_id === 'string' && reqPayload.transaction_id.startsWith('BBPSU') ? reqPayload.transaction_id : null) 
        || txnId;
      let clientTxnId = reqPayload?.client_transaction_id || existingPayload?.client_transaction_id || apiTxnId;

      const extBillPayResponse: any = {
        ...(existingPayload.ExtBillPayResponse || existingPayload.billPayResponse || {}),
        ...(billAvenueTxnData || {}),
        txnRefId: cc01Ref || existingPayload?.ExtBillPayResponse?.txnRefId || existingPayload?.billPayResponse?.txnRefId || undefined,
        responseCode: root?.responseCode || (newStatus === 'success' ? '000' : (newStatus === 'failed' ? '999' : (existingPayload?.ExtBillPayResponse?.responseCode || '000'))),
        responseReason: root?.responseReason || (newStatus === 'success' ? 'Successful' : (newStatus === 'failed' ? 'Failure' : (existingPayload?.ExtBillPayResponse?.responseReason || 'Successful'))),
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
        requestId: reqPayload?.fetchRequestId || reqPayload?.billavenue_request_id || reqPayload?.requestId || existingPayload?.requestId || trackValue,
        api_txn_id: apiTxnId,
        finalStatus: newStatus,
        payment_status: newStatus,
        transaction_id: apiTxnId,
        bbps_txn_ref_id: apiTxnId,
        client_transaction_id: clientTxnId,
        ExtBillPayResponse: extBillPayResponse,
        billPayResponse: extBillPayResponse,
        statusCheckDetails: {
          checked_at: new Date().toISOString(),
          trackType,
          trackValue,
          bbpsStatus
        }
      };

      await supabaseAdmin
        .from('b2b_api_logs')
        .update({
          payment_status: newStatus,
          status_code: newStatus === 'success' ? 200 : (newStatus === 'pending' ? 202 : 500),
          response_payload: mergedPayload
        })
        .eq('id', log.id);

    } catch (err: any) {
      console.log(`-> Error: ${err.message}`);
    }

    // Small delay between requests to be gentle on BillAvenue API
    await sleep(250);
  }

  console.log('\n====================================================');
  console.log('Sync Summary:');
  console.log(`- Total Processed: ${logs.length}`);
  console.log(`- Updated to SUCCESS: ${successCount}`);
  console.log(`- Updated to FAILED (Refunded): ${failedCount}`);
  console.log(`- Still Pending: ${stillPendingCount}`);
  console.log(`- Skipped (No ID): ${skippedCount}`);
  console.log('====================================================\n');
}

run().catch(console.error);
