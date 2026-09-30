import { Request, Response } from 'express';
import { supabaseAdmin } from '../../server';
import * as billAvenue from '../../services/billavenue';
import * as camlenioBbps from '../../services/camlenio_bbps.js';
import { notifyAdminNewB2BFundRequest } from '../../services/whatsapp_service.js';
import { executeNixasoftPayout, checkNixasoftStatus, calculateSlabCharge, getNixasoftConfig, PayoutSlab } from '../../services/nixasoft_payout.js';

export const getCategories = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('biller_categories_settings')
      .select('*')
      .eq('provider', 'billavenue')
      .order('category_name', { ascending: true });

    if (error) throw error;
    res.json({ status: 'success', data });
  } catch (err: any) {
    console.error('[B2B getCategories Error]', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch categories' });
  }
};

export const getBillers = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId;
    const { category_id, state, page = '1', limit = '500' } = req.query;

    // 1. Enforce Daily Limit (50 requests/day for biller sync)
    const today = new Date().toISOString().split('T')[0];
    const { count: dailyRequests, error: logError } = await supabaseAdmin
      .from('b2b_api_logs')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('endpoint', '/api/b2b/billers')
      .gte('created_at', today);

    if (logError) throw logError;

    if (dailyRequests && dailyRequests >= 50) {
      return res.status(429).json({
        status: 'error',
        message: 'Daily limit of 50 requests reached for biller sync. Please try again tomorrow.'
      });
    }

    // 2. Pagination constraints
    let pageNum = parseInt(page as string, 10);
    let limitNum = parseInt(limit as string, 10);

    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if (isNaN(limitNum) || limitNum < 1) limitNum = 500;
    if (limitNum > 500) limitNum = 500; // Force max 500 to protect the server

    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabaseAdmin
      .from('billavenue_billers')
      .select('*', { count: 'exact' });

    if (category_id) {
      // If category_id is a number, we might need to map it, but assuming it's the category name
      query = query.eq('category', category_id);
    }
    if (state) {
      // In BillAvenue billers state may be stored in coverage or state column, assuming 'state' or ilike logic if present
      query = query.ilike('biller_name', `%${state}%`); // Fallback if state filtering is needed
    }

    // Apply pagination
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    // 3. Log the successful request to track usage
    await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/b2b/billers',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: req.query,
        status_code: 200,
        response_payload: { message: `Fetched page ${pageNum} with ${data?.length} billers` }
      });

    res.json({
      status: 'success',
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total_records: count || 0,
        total_pages: count ? Math.ceil(count / limitNum) : 0
      }
    });
  } catch (err: any) {
    console.error('[B2B getBillers Error]', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch billers' });
  }
};

export const fetchBill = async (req: Request, res: Response) => {
  try {

    const { billerId, customerParams, mobile } = req.body;

    if (!billerId || !customerParams || !mobile) {
      return res.status(400).json({ status: 'error', message: 'billerId, customerParams, and mobile are required' });
    }

    // Convert array format to Record format if needed
    let formattedParams: Record<string, string> = {};
    if (Array.isArray(customerParams)) {
      customerParams.forEach((p: any) => {
        if (p.name && p.value !== undefined) {
          formattedParams[p.name] = String(p.value);
        }
      });
    } else {
      formattedParams = customerParams;
    }

    // Call BillAvenue Service
    const billavenueAgentId = (req as any).billavenueAgentId;
    const response = await billAvenue.fetchBill(billerId, formattedParams, mobile, 'AGT', billavenueAgentId);

    const isStaging = process.env.BILLAVENUE_ENV !== 'production';
    const responseCode = response.json?.billFetchResponse?.responseCode;

    let finalJsonResponse = response.json;

    if (isStaging && responseCode !== '0000') {
      console.log(`[B2B Proxy] Staging: Biller ${billerId} returned API error ${responseCode}. Returning Mock Staging Bill.`);

      let billerCategory = 'Utility';
      let billerName = 'UAT Test Biller';
      try {
        const { data: dbBiller } = await supabaseAdmin
          .from('billavenue_billers')
          .select('category, biller_name')
          .eq('biller_id', billerId)
          .maybeSingle();
        if (dbBiller) {
          billerCategory = dbBiller.category || 'Utility';
          billerName = dbBiller.biller_name || 'UAT Test Biller';
        }
      } catch (dbErr) {
        console.warn('Failed to load biller info for mock:', dbErr);
      }

      finalJsonResponse = {
        billFetchResponse: {
          responseCode: '0000',
          responseReason: 'Successful',
          customerName: 'Sumit C Patel (B2B Mock)',
          billAmount: '10000', // ₹100.00 (in paise)
          dueDate: '2026-06-30',
          billNumber: 'BILL998811',
          billDate: '2026-06-01',
          billPeriod: 'Monthly',
          additionalInfo: {
            info: [
              { infoName: 'Consumer ID', infoValue: formattedParams[Object.keys(formattedParams)[0]] || '123456' },
              { infoName: 'Biller Name', infoValue: billerName },
              { infoName: 'Category', infoValue: billerCategory }
            ]
          },
          requestId: response.requestId
        }
      };
    }

    // Log the fetch attempt
    await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: (req as any).agentId,
        endpoint: '/api/b2b/fetch-bill',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: req.body,
        status_code: 200,
        response_payload: finalJsonResponse
      });

    const finalResponseCode = finalJsonResponse?.billFetchResponse?.responseCode;
    const billerResp = finalJsonResponse?.billFetchResponse?.billerResponse || finalJsonResponse?.billFetchResponse || {};

    const rawBillAmount = billerResp.billAmount || '0';
    const amountInRupees = (Number(rawBillAmount) / 100).toFixed(2);

    res.json({
      status: (finalResponseCode === '000' || finalResponseCode === '0000') ? 'success' : 'error',
      message: (finalResponseCode === '000' || finalResponseCode === '0000') ? 'Bill fetched successfully' : (billerResp.responseReason || 'Failed to fetch bill'),
      data: {
        responseCode: finalResponseCode,
        requestId: response.requestId,
        ...finalJsonResponse,
        billerResponse: {
          ...billerResp,
          billAmount: amountInRupees,
          amount: amountInRupees
        },
        additionalInfo: billerResp.additionalInfo || {}
      }
    });

  } catch (err: any) {
    console.error('[B2B fetchBill Error]', err);
    await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: (req as any).agentId,
        endpoint: '/api/b2b/fetch-bill',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: req.body,
        status_code: 500,
        response_payload: { error: err.message || 'Failed to fetch bill' }
      });
    res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch bill' });
  }
};

export const getBalance = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId;
    const { data, error } = await supabaseAdmin
      .from('b2b_api_credentials')
      .select('wallet_balance, payout_wallet_balance, cspl_wallet_balance, is_bbps_enabled, is_payout_enabled, is_cspl_enabled, fixed_deposit_amount')
      .eq('id', agentId)
      .single();

    if (error) throw error;

    // Log balance check into b2b_api_logs for full developer observability
    await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/b2b/balance',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: {},
        status_code: 200,
        response_payload: {
          balance: data.wallet_balance || 0,
          payout_wallet_balance: data.payout_wallet_balance || 0,
          cspl_wallet_balance: data.cspl_wallet_balance || 0,
          usable_bbps_balance: Math.max(0, (data.wallet_balance || 0) - (data.fixed_deposit_amount || 0))
        }
      });

    res.json({
      status: 'success',
      data: {
        balance: data.wallet_balance || 0,
        bbps_wallet_balance: data.wallet_balance || 0,
        payout_wallet_balance: data.payout_wallet_balance || 0,
        cspl_wallet_balance: data.cspl_wallet_balance || 0,
        usable_bbps_balance: Math.max(0, (data.wallet_balance || 0) - (data.fixed_deposit_amount || 0)),
        fixed_deposit_amount: data.fixed_deposit_amount || 0,
        is_bbps_enabled: data.is_bbps_enabled !== false,
        is_payout_enabled: !!data.is_payout_enabled,
        is_cspl_enabled: !!data.is_cspl_enabled
      }
    });
  } catch (err: any) {
    console.error('[B2B getBalance Error]', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch balance' });
  }
};

/**
 * Check BBPS Transaction Status (Admin/Global trigger)
 */
export const checkStatusAdmin = async (req: Request, res: Response): Promise<any> => {
  const { transaction_id } = req.params;

  if (!transaction_id) {
    return res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
  }

  try {
    let { data: log, error: logError } = await supabaseAdmin
      .from('b2b_api_logs')
      .select('*')
      .or('endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill')
      .contains('request_payload', { transaction_id })
      .maybeSingle();

    if (!log) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transaction_id);
      const { data: altLog } = await supabaseAdmin
        .from('b2b_api_logs')
        .select('*')
        .or('endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill')
        .or(`${isUuid ? `id.eq.${transaction_id},` : ''}request_payload->>transaction_id.eq.${transaction_id},request_payload->>client_transaction_id.eq.${transaction_id},request_payload->>fetchRequestId.eq.${transaction_id},request_payload->>billavenue_request_id.eq.${transaction_id},response_payload->>transaction_id.eq.${transaction_id},response_payload->>api_txn_id.eq.${transaction_id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (altLog) log = altLog;
    }

    if (!log) {
      // Fallback search across recent 200 logs for CC01 or substring match
      const { data: recentLogs } = await supabaseAdmin
        .from('b2b_api_logs')
        .select('*')
        .or('endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill')
        .order('created_at', { ascending: false })
        .limit(200);

      if (recentLogs) {
        log = recentLogs.find(l => {
          const reqStr = JSON.stringify(l.request_payload || {});
          const resStr = JSON.stringify(l.response_payload || {});
          return reqStr.includes(transaction_id) || resStr.includes(transaction_id) || l.id === transaction_id;
        }) || null;
      }
    }

    if (!log) {
      return res.status(404).json({ status: 'error', message: `Transaction ${transaction_id} not found in logs` });
    }

    const bpr = log.response_payload?.billPayResponse || log.response_payload?.ExtBillPayResponse || log.response_payload;
    const cc01RefId = bpr?.txnRefId || bpr?.billerResponse?.txnRefId || log.request_payload?.billerResponseInfo?.txnRefId;
    
    // Check with TRANS_REF_ID if CC01 exists, else check with REQUEST_ID
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

    if (!trackValue) {
      const errorMsg = bpr?.errorInfo?.error?.errorMessage 
        || log.response_payload?.reason 
        || log.response_payload?.error 
        || 'Bill payment failed at BillAvenue gateway (Neither CC01 Ref nor Request ID found).';

      const isFailedOrError = log.payment_status === 'failed' 
        || log.response_payload?.finalStatus === 'failed' 
        || !!bpr?.errorInfo 
        || (bpr?.responseCode && bpr?.responseCode !== '000');

      if (isFailedOrError) {
        // If local status is still pending, update DB to failed & refund agent
        if (log.payment_status === 'pending') {
          const refundAmount = log.request_payload?.totalDeduction || 0;
          if (refundAmount > 0) {
            await supabaseAdmin.rpc('add_b2b_wallet_balance', { p_agent_id: log.agent_id, p_amount: refundAmount });
          }
          await supabaseAdmin
            .from('b2b_api_logs')
            .update({ 
              payment_status: 'failed', 
              status_code: 500, 
              charge_deducted: 0,
              response_payload: { ...log.response_payload, payment_status: 'failed', finalStatus: 'failed', failureReason: errorMsg } 
            })
            .eq('id', log.id);
        }

        return res.json({
          status: 'success',
          data: {
            transaction_id,
            current_status: 'failed',
            bbps_status: 'FAILED',
            message: errorMsg,
            polled_at: new Date().toISOString()
          }
        });
      }

      return res.status(400).json({
        status: 'error',
        message: `Neither BillAvenue CC01 Transaction Reference ID nor Request ID found for transaction ${transaction_id}. ${errorMsg}`
      });
    }

    console.log(`[B2B Admin CheckStatus] Checking status for ${transaction_id} using ${trackType}: ${trackValue}`);
    const statusResult = await billAvenue.getTransactionStatus(trackValue, trackType);
    let bbpsStatus = 'UNKNOWN';
    let billAvenueTxnData: any = null;
    
    let root: any = null;
    if (statusResult?.json) {
       root = statusResult.json.transactionStatusResp || statusResult.json.transactionStatusRes || statusResult.json.transactionStatusResponse;
       if (root) {
         if (root.responseCode === '205') {
           console.warn(`[B2B Admin CheckStatus] Response code 205 (No Txn mapped) received for ${transaction_id}`);
           bbpsStatus = 'FAILED';
         } else if (root.responseCode !== '000') {
           console.warn(`[B2B Admin CheckStatus] Non-000 response code (${root.responseCode}) received for ${transaction_id}`);
           bbpsStatus = 'PENDING';
         } else {
           const txnList = Array.isArray(root.txnList) ? root.txnList[0] : root.txnList;
           billAvenueTxnData = txnList;
           const rawTxnStatus = txnList?.txnStatus?.toUpperCase() || '';
           const errCode = txnList?.errorInfo?.error?.errorCode || txnList?.errorCode || '';
           const errMsg = (txnList?.errorInfo?.error?.errorMessage || txnList?.errorMessage || '').toLowerCase();

           if (rawTxnStatus === 'SUCCESS' || rawTxnStatus === 'APPROVED') {
             bbpsStatus = 'SUCCESS';
           } else if (rawTxnStatus === 'FAILED' || rawTxnStatus === 'FAILURE' || rawTxnStatus === 'REJECTED') {
             bbpsStatus = 'FAILED';
           } else if (rawTxnStatus === 'AWAITED' || rawTxnStatus === 'PENDING' || errCode === 'PNR001' || errCode === 'PWB001' || errMsg.includes('in progress') || errMsg.includes('awaited')) {
             bbpsStatus = 'AWAITED';
           } else if (errCode || errMsg) {
             bbpsStatus = 'FAILED';
           } else {
             bbpsStatus = rawTxnStatus || 'UNKNOWN';
           }
         }
       }
    }
    
    let localStatus = log.payment_status || 'pending';
    
    // If BBPS Status is terminal or pending and differs from local status, update atomically
    if ((bbpsStatus === 'SUCCESS' || bbpsStatus === 'APPROVED') && localStatus !== 'success') {
      console.log(`[B2B Admin CheckStatus] Transaction ${transaction_id} is SUCCESS on BillAvenue. Updating status from ${localStatus} to success via RPC...`);
      await supabaseAdmin.rpc('admin_update_b2b_bill_status', {
        p_log_id: log.id,
        p_status: 'success'
      });
      localStatus = 'success';
    } else if ((bbpsStatus === 'FAILED' || bbpsStatus === 'FAILURE' || bbpsStatus === 'REJECTED') && localStatus !== 'failed') {
      console.log(`[B2B Admin CheckStatus] Transaction ${transaction_id} is FAILED on BillAvenue. Updating status from ${localStatus} to failed via RPC...`);
      await supabaseAdmin.rpc('admin_update_b2b_bill_status', {
        p_log_id: log.id,
        p_status: 'failed'
      });
      localStatus = 'failed';
    } else if ((bbpsStatus === 'AWAITED' || bbpsStatus === 'PENDING') && localStatus !== 'pending') {
      console.log(`[B2B Admin CheckStatus] Transaction ${transaction_id} is AWAITED / PENDING on BillAvenue. Updating status from ${localStatus} to pending...`);
      if (localStatus === 'failed') {
        const totalDeduction = Number(log.request_payload?.totalDeduction || log.request_payload?.amount || 0);
        if (totalDeduction > 0) {
          await supabaseAdmin.rpc('deduct_b2b_wallet_balance', {
            p_agent_id: log.agent_id,
            p_amount: totalDeduction
          });
          console.log(`[B2B Admin CheckStatus] Re-deducted ₹${totalDeduction} from agent ${log.agent_id} wallet because bill is AWAITED/PENDING at gateway.`);
        }
      } else if (localStatus === 'success') {
        const chargeDeducted = Number(log.charge_deducted || log.request_payload?.chargeDeducted || 0);
        if (chargeDeducted > 0) {
          await supabaseAdmin.rpc('add_admin_balance', { p_amount: -chargeDeducted });
        }
      }
      localStatus = 'pending';
      await supabaseAdmin
        .from('b2b_api_logs')
        .update({
          payment_status: 'pending',
          status_code: 202,
          charge_deducted: 0
        })
        .eq('id', log.id);
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
      || transaction_id;
    let clientTxnId = reqPayload?.client_transaction_id || existingPayload?.client_transaction_id || apiTxnId;

    const isGatewaySuccess = bbpsStatus === 'SUCCESS' || bbpsStatus === 'APPROVED';
    const isGatewayPending = bbpsStatus === 'AWAITED' || bbpsStatus === 'PENDING';
    const isGatewayFailed = bbpsStatus === 'FAILED' || bbpsStatus === 'FAILURE' || bbpsStatus === 'REJECTED';

    const extBillPayResponse: any = {
      ...(existingPayload.ExtBillPayResponse || existingPayload.billPayResponse || {}),
      ...(billAvenueTxnData || {}),
      txnStatus: bbpsStatus,
      txnRefId: cc01Ref || existingPayload?.ExtBillPayResponse?.txnRefId || existingPayload?.billPayResponse?.txnRefId || undefined,
      responseCode: isGatewaySuccess ? '000' : (isGatewayPending ? '001' : (isGatewayFailed ? '999' : (existingPayload?.ExtBillPayResponse?.responseCode || '001'))),
      responseReason: isGatewaySuccess ? 'Successful' : (isGatewayPending ? 'Awaited' : (isGatewayFailed ? 'Failure' : (existingPayload?.ExtBillPayResponse?.responseReason || 'Pending'))),
      approvalRefNumber: billAvenueTxnData?.approvalRefNumber || existingPayload?.ExtBillPayResponse?.approvalRefNumber || undefined,
      RespAmount: billAvenueTxnData?.amount ? String(Math.round(Number(billAvenueTxnData.amount) * 100)) : (existingPayload?.ExtBillPayResponse?.RespAmount || undefined),
      CustConvFee: billAvenueTxnData?.custConvFee || existingPayload?.ExtBillPayResponse?.CustConvFee || '0',
      RespCustomerName: billAvenueTxnData?.respCustomerName || reqPayload?.billerResponseInfo?.customerName || existingPayload?.ExtBillPayResponse?.RespCustomerName || undefined,
      txnRespType: billAvenueTxnData?.txnRespType || existingPayload?.ExtBillPayResponse?.txnRespType || 'FORWARD TYPE RESPONSE'
    };

    if (isGatewaySuccess) {
      delete extBillPayResponse.errorInfo;
      delete extBillPayResponse.errorCode;
      delete extBillPayResponse.errorMessage;
    }

    if (billAvenueTxnData?.inputList && !extBillPayResponse.inputParams) {
      extBillPayResponse.inputParams = { input: billAvenueTxnData.inputList };
    }

    const mergedPayload = {
      ...existingPayload,
      requestId: reqPayload?.fetchRequestId || reqPayload?.billavenue_request_id || reqPayload?.requestId || existingPayload?.requestId || trackValue,
      api_txn_id: apiTxnId,
      finalStatus: localStatus,
      payment_status: localStatus,
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
        payment_status: localStatus,
        status_code: localStatus === 'success' ? 200 : (localStatus === 'pending' ? 202 : 500),
        response_payload: mergedPayload
      })
      .eq('id', log.id);

    return res.json({
      status: 'success',
      data: {
        transaction_id,
        current_status: localStatus,
        status: localStatus,
        payment_status: localStatus,
        bbps_status: bbpsStatus,
        bbps_txn_id: cc01Ref || undefined,
        approval_ref_number: billAvenueTxnData?.approvalRefNumber || undefined,
        polled_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[B2B Admin CheckStatus Error]', error);
    return res.status(500).json({ status: 'error', message: 'Failed to check transaction status', details: error.message });
  }
};

/**
 * Check BBPS Transaction Status
 */
export const checkStatus = async (req: Request, res: Response): Promise<any> => {
  const { transaction_id } = req.params;
  const agentId = (req as any).agentId;

  if (!transaction_id) {
    return res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
  }

  try {
    const targetTxnId = String(transaction_id).trim();

    // 1. Fetch past pay-bill logs for this agent to find matching transaction
    const { data: logs, error: logError } = await supabaseAdmin
      .from('b2b_api_logs')
      .select('*')
      .eq('agent_id', agentId)
      .or('endpoint.eq./api/b2b/pay-bill,endpoint.eq./api/v1/b2b/pay-bill')
      .order('created_at', { ascending: false })
      .limit(200);

    if (logError || !logs || logs.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No transactions found for this agent' });
    }

    // Match by response transaction_id (BBPSU...), request transaction_id / client_transaction_id, or CC01 ID
    const log = logs.find(l => {
      const resPayload = l.response_payload || {};
      const reqPayload = l.request_payload || {};
      const cc01Id = resPayload?.billPayResponse?.txnRefId || resPayload?.ExtBillPayResponse?.txnRefId || resPayload?.txnRefId;
      
      return (
        resPayload?.transaction_id === targetTxnId ||
        resPayload?.api_txn_id === targetTxnId ||
        reqPayload?.transaction_id === targetTxnId ||
        reqPayload?.api_txn_id === targetTxnId ||
        reqPayload?.client_transaction_id === targetTxnId ||
        reqPayload?.fetchRequestId === targetTxnId ||
        reqPayload?.billavenue_request_id === targetTxnId ||
        reqPayload?.requestId === targetTxnId ||
        resPayload?.requestId === targetTxnId ||
        cc01Id === targetTxnId
      );
    });

    if (!log) {
      return res.status(404).json({ status: 'error', message: `Transaction ${targetTxnId} not found for this agent` });
    }

    const reqPayload = log.request_payload || {};
    const resPayload = log.response_payload || {};

    // Determine the unique BBPSU Platform ID and Agent's Client Transaction ID
    let apiTxnId = resPayload?.api_txn_id || reqPayload?.api_txn_id;
    if (!apiTxnId) {
      if (typeof resPayload?.transaction_id === 'string' && resPayload.transaction_id.startsWith('BBPSU')) {
        apiTxnId = resPayload.transaction_id;
      } else if (typeof reqPayload?.transaction_id === 'string' && reqPayload.transaction_id.startsWith('BBPSU')) {
        apiTxnId = reqPayload.transaction_id;
      } else {
        apiTxnId = `BBPSU${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      }
    }

    const clientTxnId = reqPayload?.client_transaction_id 
      || (targetTxnId.startsWith('BBPSU') ? (reqPayload?.transaction_id || apiTxnId) : targetTxnId);

    const bpr = resPayload?.billPayResponse || resPayload?.ExtBillPayResponse || resPayload;
    const cc01RefId = bpr?.txnRefId || bpr?.billerResponse?.txnRefId || reqPayload?.billerResponseInfo?.txnRefId;

    let localStatus = log.payment_status || 'pending';

    // Check with TRANS_REF_ID if CC01 exists, else check with REQUEST_ID
    const requestIdCandidate = reqPayload?.fetchRequestId
      || reqPayload?.billavenue_request_id
      || reqPayload?.requestId
      || resPayload?.requestId
      || reqPayload?.payRequestId
      || resPayload?.payRequestId;

    let trackType = '';
    let trackValue = '';

    if (cc01RefId && String(cc01RefId).startsWith('CC01')) {
      trackType = 'TRANS_REF_ID';
      trackValue = String(cc01RefId);
    } else if (requestIdCandidate) {
      trackType = 'REQUEST_ID';
      trackValue = String(requestIdCandidate);
    }

    // 2. SCENARIO A: Neither CC01 Ref ID nor Request ID exists
    if (!trackValue) {
      if (localStatus === 'pending') {
        const refundAmount = reqPayload?.totalDeduction || reqPayload?.amount || 0;
        let updatedPayload = resPayload;
        updatedPayload = { 
          ...updatedPayload, 
          finalStatus: 'failed', 
          payment_status: 'failed',
          transaction_id: apiTxnId,
          api_txn_id: apiTxnId,
          client_transaction_id: clientTxnId,
          bbps_txn_ref_id: apiTxnId,
          reason: 'Bill payment failed to reach BillAvenue gateway (No CC01 Ref or Request ID).'
        };

        await supabaseAdmin
          .from('b2b_api_logs')
          .update({ 
            payment_status: 'failed',
            status_code: 500,
            charge_deducted: 0,
            response_payload: updatedPayload
          })
          .eq('id', log.id);

        if (refundAmount > 0) {
          await supabaseAdmin.rpc('add_b2b_wallet_balance', {
            p_agent_id: log.agent_id,
            p_amount: refundAmount
          });
        }

        return res.json({
          status: 'success',
          data: {
            transaction_id: apiTxnId,
            api_txn_id: apiTxnId,
            client_transaction_id: clientTxnId,
            bbps_txn_ref_id: apiTxnId,
            current_status: 'failed',
            bbps_status: 'FAILED_GATEWAY_ERROR',
            message: 'Bill payment failed to connect to biller gateway. Agent wallet has been refunded.',
            refund_status: 'REFUNDED',
            refunded_amount: refundAmount,
            polled_at: new Date().toISOString()
          }
        });
      }

      return res.json({
        status: 'success',
        data: {
          transaction_id: apiTxnId,
          api_txn_id: apiTxnId,
          client_transaction_id: clientTxnId,
          bbps_txn_ref_id: apiTxnId,
          current_status: localStatus,
          bbps_status: localStatus.toUpperCase(),
          polled_at: new Date().toISOString()
        }
      });
    }

    // 3. SCENARIO B: Query BillAvenue Live Status via TRANS_REF_ID or REQUEST_ID
    console.log(`[B2B CheckStatus] Querying BillAvenue live status for ${targetTxnId} via ${trackType}: ${trackValue}`);
    const statusResult = await billAvenue.getTransactionStatus(trackValue, trackType);
    let bbpsStatus = 'UNKNOWN';
    let billAvenueTxnData: any = null;
    
    let root: any = null;
    if (statusResult?.json) {
       root = statusResult.json.transactionStatusResp || statusResult.json.transactionStatusRes || statusResult.json.transactionStatusResponse;
       if (root) {
         if (root.responseCode === '205') {
           console.warn(`[B2B CheckStatus] Response code 205 (No Txn mapped against ${trackType}) for ${targetTxnId}`);
           bbpsStatus = 'FAILED';
         } else if (root.responseCode !== '000') {
           console.warn(`[B2B CheckStatus] Non-000 response code (${root.responseCode}) received for ${targetTxnId}`);
           bbpsStatus = 'PENDING';
         } else {
           const txnList = Array.isArray(root.txnList) ? root.txnList[0] : root.txnList;
           billAvenueTxnData = txnList;
           const rawTxnStatus = txnList?.txnStatus?.toUpperCase() || '';
           const errCode = txnList?.errorInfo?.error?.errorCode || txnList?.errorCode || '';
           const errMsg = (txnList?.errorInfo?.error?.errorMessage || txnList?.errorMessage || '').toLowerCase();

           if (rawTxnStatus === 'SUCCESS' || rawTxnStatus === 'APPROVED') {
             bbpsStatus = 'SUCCESS';
           } else if (rawTxnStatus === 'FAILED' || rawTxnStatus === 'FAILURE' || rawTxnStatus === 'REJECTED') {
             bbpsStatus = 'FAILED';
           } else if (rawTxnStatus === 'AWAITED' || rawTxnStatus === 'PENDING' || errCode === 'PNR001' || errCode === 'PWB001' || errMsg.includes('in progress') || errMsg.includes('awaited')) {
             bbpsStatus = 'AWAITED';
           } else if (errCode || errMsg) {
             bbpsStatus = 'FAILED';
           } else {
             bbpsStatus = rawTxnStatus || 'UNKNOWN';
           }
         }
       }
    }

    // If BBPS Status is terminal or pending and differs from local status, update atomically
    if ((bbpsStatus === 'SUCCESS' || bbpsStatus === 'APPROVED') && localStatus !== 'success') {
      console.log(`[B2B CheckStatus] Transaction ${targetTxnId} is SUCCESS on BillAvenue. Updating status from ${localStatus} to success via RPC...`);
      await supabaseAdmin.rpc('admin_update_b2b_bill_status', {
        p_log_id: log.id,
        p_status: 'success'
      });
      localStatus = 'success';
    } else if ((bbpsStatus === 'FAILED' || bbpsStatus === 'FAILURE' || bbpsStatus === 'REJECTED') && localStatus !== 'failed') {
      console.log(`[B2B CheckStatus] Transaction ${targetTxnId} is FAILED on BillAvenue. Updating status from ${localStatus} to failed via RPC...`);
      await supabaseAdmin.rpc('admin_update_b2b_bill_status', {
        p_log_id: log.id,
        p_status: 'failed'
      });
      localStatus = 'failed';
    } else if ((bbpsStatus === 'AWAITED' || bbpsStatus === 'PENDING') && localStatus !== 'pending') {
      console.log(`[B2B CheckStatus] Transaction ${targetTxnId} is AWAITED / PENDING on BillAvenue. Updating status from ${localStatus} to pending...`);
      if (localStatus === 'failed') {
        const totalDeduction = Number(log.request_payload?.totalDeduction || log.request_payload?.amount || 0);
        if (totalDeduction > 0) {
          await supabaseAdmin.rpc('deduct_b2b_wallet_balance', {
            p_agent_id: log.agent_id,
            p_amount: totalDeduction
          });
          console.log(`[B2B CheckStatus] Re-deducted ₹${totalDeduction} from agent ${log.agent_id} wallet because bill is AWAITED/PENDING at gateway.`);
        }
      } else if (localStatus === 'success') {
        const chargeDeducted = Number(log.charge_deducted || log.request_payload?.chargeDeducted || 0);
        if (chargeDeducted > 0) {
          await supabaseAdmin.rpc('add_admin_balance', { p_amount: -chargeDeducted });
        }
      }
      localStatus = 'pending';
      await supabaseAdmin
        .from('b2b_api_logs')
        .update({
          payment_status: 'pending',
          status_code: 202,
          charge_deducted: 0
        })
        .eq('id', log.id);
    }

    // Always merge and persist the FULL gateway response into response_payload
    const existingPayload = resPayload || log.response_payload || {};
    const cc01Ref = billAvenueTxnData?.txnReferenceId 
      || billAvenueTxnData?.txnRefId 
      || existingPayload?.ExtBillPayResponse?.txnRefId 
      || existingPayload?.billPayResponse?.txnRefId 
      || (typeof existingPayload?.txnRefId === 'string' && existingPayload.txnRefId.startsWith('CC01') ? existingPayload.txnRefId : undefined);

    const isGatewaySuccess = bbpsStatus === 'SUCCESS' || bbpsStatus === 'APPROVED';
    const isGatewayPending = bbpsStatus === 'AWAITED' || bbpsStatus === 'PENDING';
    const isGatewayFailed = bbpsStatus === 'FAILED' || bbpsStatus === 'FAILURE' || bbpsStatus === 'REJECTED';

    const extBillPayResponse: any = {
      ...(existingPayload.ExtBillPayResponse || existingPayload.billPayResponse || {}),
      ...(billAvenueTxnData || {}),
      txnStatus: bbpsStatus,
      txnRefId: cc01Ref || existingPayload?.ExtBillPayResponse?.txnRefId || existingPayload?.billPayResponse?.txnRefId || undefined,
      responseCode: isGatewaySuccess ? '000' : (isGatewayPending ? '001' : (isGatewayFailed ? '999' : (existingPayload?.ExtBillPayResponse?.responseCode || '001'))),
      responseReason: isGatewaySuccess ? 'Successful' : (isGatewayPending ? 'Awaited' : (isGatewayFailed ? 'Failure' : (existingPayload?.ExtBillPayResponse?.responseReason || 'Pending'))),
      approvalRefNumber: billAvenueTxnData?.approvalRefNumber || existingPayload?.ExtBillPayResponse?.approvalRefNumber || undefined,
      RespAmount: billAvenueTxnData?.amount ? String(Math.round(Number(billAvenueTxnData.amount) * 100)) : (existingPayload?.ExtBillPayResponse?.RespAmount || undefined),
      CustConvFee: billAvenueTxnData?.custConvFee || existingPayload?.ExtBillPayResponse?.CustConvFee || '0',
      RespCustomerName: billAvenueTxnData?.respCustomerName || reqPayload?.billerResponseInfo?.customerName || existingPayload?.ExtBillPayResponse?.RespCustomerName || undefined,
      txnRespType: billAvenueTxnData?.txnRespType || existingPayload?.ExtBillPayResponse?.txnRespType || 'FORWARD TYPE RESPONSE'
    };

    if (isGatewaySuccess) {
      delete extBillPayResponse.errorInfo;
      delete extBillPayResponse.errorCode;
      delete extBillPayResponse.errorMessage;
    }

    if (billAvenueTxnData?.inputList && !extBillPayResponse.inputParams) {
      extBillPayResponse.inputParams = { input: billAvenueTxnData.inputList };
    }

    const mergedPayload = {
      ...existingPayload,
      requestId: reqPayload?.fetchRequestId || reqPayload?.billavenue_request_id || reqPayload?.requestId || existingPayload?.requestId || trackValue,
      api_txn_id: apiTxnId,
      finalStatus: localStatus,
      payment_status: localStatus,
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
        payment_status: localStatus,
        status_code: localStatus === 'success' ? 200 : (localStatus === 'pending' ? 202 : 500),
        response_payload: mergedPayload
      })
      .eq('id', log.id);

    return res.json({
      status: localStatus,
      payment_status: localStatus,
      data: {
        transaction_id: apiTxnId,
        api_txn_id: apiTxnId,
        client_transaction_id: clientTxnId,
        bbps_txn_ref_id: apiTxnId,
        bbps_txn_id: cc01Ref || undefined,
        approval_ref_number: billAvenueTxnData?.approvalRefNumber || undefined,
        current_status: localStatus,
        status: localStatus,
        payment_status: localStatus,
        bbps_status: bbpsStatus,
        polled_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[B2B CheckStatus Error]', error);
    return res.status(500).json({ status: 'error', message: 'Failed to check transaction status', details: error.message });
  }
};

export const payBill = async (req: Request, res: Response) => {
  try {

    const { billerId, amount, customerParams, mobile, billerResponseInfo, fetchRequestId, additionalInfo, paymentMode, pan, customerPan } = req.body;
    const agentId = (req as any).agentId;
    const billavenueAgentId = (req as any).billavenueAgentId;
    const finalPan = (customerPan || pan || '').trim();

    console.log(`\n[B2B PayBill - START] Agent: ${agentId}, Biller: ${billerId}, Amount: ${amount}, PAN: ${finalPan || 'N/A'}`);
    console.log(`[B2B PayBill] Request Body:`, JSON.stringify(req.body));

    if (!billerId || !amount || !customerParams || !mobile) {
      console.error(`[B2B PayBill - ERROR] Missing parameters`);
      return res.status(400).json({ status: 'error', message: 'Missing required parameters for payment' });
    }

    const parsedAmount = parseFloat(amount);
    const selectedMode = (paymentMode || 'Cash').trim();

    // Check RBI/BillAvenue rule: Cash payment of >= 50,000 requires PAN card
    if (parsedAmount >= 50000 && selectedMode.toUpperCase() === 'CASH' && !finalPan) {
      console.error(`[B2B PayBill - ERROR] PAN Card missing for transaction >= ₹50,000 with Cash mode`);
      return res.status(400).json({
        status: 'error',
        message: 'PAN Card (customerPan / pan) is mandatory for Cash bill payments of ₹50,000 or above as per RBI guidelines. Alternatively, pass paymentMode as "UPI" or "Internet Banking".'
      });
    }

    // Fetch agent's charge_per_bill, developer_charge, owner_charge, custom_max_bill_payment_limit, fixed_deposit_amount, wallet_balance
    const { data: agentData } = await supabaseAdmin
      .from('b2b_api_credentials')
      .select('charge_per_bill, developer_charge, owner_charge, custom_max_bill_payment_limit, fixed_deposit_amount, wallet_balance, webhook_url')
      .eq('id', agentId)
      .single();

    // Fetch global settings
    const { data: globalSettings } = await supabaseAdmin
      .from('b2b_settings')
      .select('global_charge_per_bill, max_bill_payment_limit')
      .limit(1)
      .maybeSingle();

    // 1. Dynamic Max Single Bill Payment Limit Check
    const customAgentLimit = parseFloat(agentData?.custom_max_bill_payment_limit?.toString() || '0');
    const globalMaxLimit = parseFloat(globalSettings?.max_bill_payment_limit?.toString() || '100000');
    const maxAllowedLimit = customAgentLimit > 0 ? customAgentLimit : globalMaxLimit;

    if (parsedAmount > maxAllowedLimit) {
      console.error(`[B2B PayBill - ERROR] Bill amount ₹${parsedAmount} exceeds max limit ₹${maxAllowedLimit}`);
      return res.status(400).json({
        status: 'error',
        message: `Transaction amount ₹${parsedAmount.toLocaleString('en-IN')} exceeds maximum allowed single bill payment limit of ₹${maxAllowedLimit.toLocaleString('en-IN')}.`
      });
    }

    let baseChargePerBill = 0;
    let baseDeveloperCharge = parseFloat(agentData?.developer_charge?.toString() || '0');
    let baseOwnerCharge = parseFloat(agentData?.owner_charge?.toString() || '0');

    if (agentData?.charge_per_bill !== null && agentData?.charge_per_bill !== undefined) {
      baseChargePerBill = parseFloat(agentData.charge_per_bill);
    } else if (globalSettings) {
      baseChargePerBill = parseFloat(globalSettings.global_charge_per_bill?.toString() || '0');
    }

    // If split charges are missing or incomplete, ensure baseOwnerCharge equals baseChargePerBill
    if (baseDeveloperCharge === 0 && baseOwnerCharge === 0 && baseChargePerBill > 0) {
      baseOwnerCharge = baseChargePerBill;
    }

    // Dynamic 50k Slab Multiplier:
    // ₹1 to ₹49,999 => 1x (Base Charge)
    // ₹50,000 to ₹99,999 => 2x (Double Charge)
    // ₹1,00,000 to ₹1,49,999 => 3x (Triple Charge)
    // ₹1,50,000 to ₹1,99,999 => 4x (4-Times Charge)
    const multiplier = Math.floor(parsedAmount / 50000) + 1;

    const developerCharge = baseDeveloperCharge * multiplier;
    const ownerCharge = baseOwnerCharge * multiplier;
    const chargePerBill = developerCharge + ownerCharge;

    const totalDeduction = parsedAmount + chargePerBill;

    // Check fixed deposit frozen balance rule
    const fixedDepositAmount = parseFloat(agentData?.fixed_deposit_amount?.toString() || '0');
    const currentWalletBal = parseFloat(agentData?.wallet_balance?.toString() || '0');
    const usableBalance = Math.max(0, currentWalletBal - fixedDepositAmount);

    if (fixedDepositAmount > 0 && (currentWalletBal - totalDeduction) < fixedDepositAmount) {
      console.error(`[B2B PayBill - ERROR] Usable balance insufficient due to Fixed Security Deposit requirement. Current: ₹${currentWalletBal}, Deposit Frozen: ₹${fixedDepositAmount}, Needed: ₹${totalDeduction}`);
      return res.status(400).json({
        status: 'error',
        message: `Insufficient usable balance. ₹${fixedDepositAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is frozen as Fixed Security Deposit. Available usable balance: ₹${usableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`
      });
    }

    console.log(`[B2B PayBill - WALLET CHECK] Attempting to deduct ₹${totalDeduction} from agent ${agentId} wallet (Bill: ₹${parsedAmount}, Multiplier: ${multiplier}x, Charge: ₹${chargePerBill} [Dev: ₹${developerCharge}, Owner: ₹${ownerCharge}])...`);

    // 1. Deduct total amount securely from b2b wallet via Atomic RPC
    const { data: deductSuccess, error: walletDeductError } = await supabaseAdmin.rpc('deduct_b2b_wallet_balance', {
      p_agent_id: agentId,
      p_amount: totalDeduction
    });

    if (walletDeductError || !deductSuccess) {
      console.error(`[B2B PayBill - WALLET ERROR] Failed to deduct ₹${totalDeduction} from agent ${agentId}. Error:`, walletDeductError);
      return res.status(400).json({
        status: 'error',
        message: fixedDepositAmount > 0 
          ? `Insufficient usable balance. ₹${fixedDepositAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} is frozen as Fixed Security Deposit. Available usable balance: ₹${usableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`
          : 'Insufficient wallet balance or transaction failed'
      });
    }

    console.log(`[B2B PayBill - WALLET SUCCESS] Successfully deducted ₹${totalDeduction} from agent ${agentId}.`);

    // 1. Always generate a unique BBPSU Platform API Transaction ID and capture Agent's Client Transaction ID
    const bbpsuTxnId = `BBPSU${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const clientTxnId = (req.body.client_transaction_id || req.body.client_order_id || req.body.clientTxnId || '').trim();
    const customTxnId = clientTxnId || bbpsuTxnId;
    const billavenueRequestId = fetchRequestId || billAvenue.generateRequestId();

    // Log the transaction attempt in b2b_api_logs
    const { data: logData, error: logError } = await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/b2b/pay-bill',
        request_ip: (req as any).clientIp || req.ip,
        developer_charge: developerCharge,
        owner_charge: ownerCharge,
        request_payload: { 
          ...req.body, 
          transaction_id: bbpsuTxnId, 
          api_txn_id: bbpsuTxnId, 
          client_transaction_id: customTxnId, 
          billavenue_request_id: billavenueRequestId, 
          fetchRequestId: billavenueRequestId, 
          totalDeduction, 
          chargeDeducted: chargePerBill, 
          developerCharge, 
          ownerCharge 
        },
        response_payload: { 
          payment_status: 'pending', 
          transaction_id: bbpsuTxnId, 
          api_txn_id: bbpsuTxnId, 
          client_transaction_id: customTxnId, 
          bbps_txn_ref_id: bbpsuTxnId, 
          requestId: billavenueRequestId 
        },
        status_code: 202
      })
      .select('id')
      .single();
      
    if (logError) {
      console.error('[B2B PayBill - LOG ERROR] Failed to log transaction. Refunding amount. Error:', logError);
      await supabaseAdmin.rpc('add_b2b_wallet_balance', { p_agent_id: agentId, p_amount: totalDeduction });
      return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }

    const logId = logData?.id;

    // Convert array format to Record format if needed
    let formattedParams: Record<string, string> = {};
    if (Array.isArray(customerParams)) {
      customerParams.forEach((p: any) => {
        if (p.name && p.value !== undefined) {
          formattedParams[p.name] = String(p.value);
        }
      });
    } else {
      formattedParams = customerParams;
    }
    let rawBillerResp = { ...billerResponseInfo };
    if (rawBillerResp.billAmount && String(rawBillerResp.billAmount).includes('.')) {
      rawBillerResp.billAmount = String(Math.round(Number(rawBillerResp.billAmount) * 100));
    }
    // Delete the extra 'amount' field injected by fetchBill to prevent BBPS strict XML validation errors
    if ('amount' in rawBillerResp) {
      delete rawBillerResp.amount;
    }

    // Format additionalInfo to always be an array of { infoName, infoValue }
    let formattedAdditionalInfo: any[] = [];
    if (additionalInfo) {
      if (Array.isArray(additionalInfo)) {
        formattedAdditionalInfo = additionalInfo;
      } else if (additionalInfo.info) {
        if (Array.isArray(additionalInfo.info)) {
          formattedAdditionalInfo = additionalInfo.info;
        } else {
          formattedAdditionalInfo = [additionalInfo.info];
        }
      } else {
        // Just in case they pass { infoName: "...", infoValue: "..." }
        if (additionalInfo.infoName) {
          formattedAdditionalInfo = [additionalInfo];
        }
      }
    }

    // 2. Call BillAvenue Pay API
    let apiResponse;
    try {
      console.log(`[B2B PayBill - BILLAVENUE REQ] Calling billavenue.payBill with amount ${parsedAmount}, initChannel AGT, PAN: ${finalPan || 'None'}, ReqID: ${billavenueRequestId}...`);
      apiResponse = await billAvenue.payBill(
        billerId,
        formattedParams,
        mobile,
        parsedAmount,
        selectedMode, // paymentMode (Agent typically uses Cash/Wallet, or custom mode like UPI/Debit Card)
        'N', // quickPay
        undefined, // ccf1
        { rawBillerResponse: rawBillerResp, additionalInfo: formattedAdditionalInfo }, // billDetails
        undefined, // remitterName
        'AGT', // initChannel
        billavenueRequestId, // fetchRequestId / explicitRequestId
        billavenueAgentId,
        finalPan || undefined // customerPan
      );
      console.log(`[B2B PayBill - BILLAVENUE SUCCESS] Response received:`, JSON.stringify(apiResponse.json));
    } catch (payErr: any) {
      console.error(`[B2B PayBill - BILLAVENUE ERROR] Pay API failed for agent ${agentId}:`, payErr);
      // Refund user if API failed completely (Refund total including charge)
      await supabaseAdmin.rpc('add_b2b_wallet_balance', { p_agent_id: agentId, p_amount: totalDeduction });
      console.log(`[B2B PayBill - REFUND] Refunded ₹${totalDeduction} to agent ${agentId} due to API failure.`);

      if (logId) {
        await supabaseAdmin.from('b2b_api_logs').update({
          status_code: 500,
          response_payload: { error: payErr.message, transaction_id: customTxnId, requestId: billavenueRequestId }
        }).eq('id', logId);
      }
      return res.status(400).json({ 
        status: 'failed', 
        payment_status: 'failed',
        message: payErr.message || 'Payment failed at gateway',
        refunded: true,
        refunded_amount: totalDeduction,
        transaction_id: bbpsuTxnId,
        api_txn_id: bbpsuTxnId,
        client_transaction_id: customTxnId,
        bbps_txn_ref_id: bbpsuTxnId
      });
    }

    // 3. Process the response
    const payJson = apiResponse.json;
    const bpr = payJson?.billPayResponse || payJson?.ExtBillPayResponse || payJson?.extBillPayResponse || payJson;
    const rawResponseCode = String(bpr?.responseCode || payJson?.responseCode || '').trim();
    const rawResponseReason = String(bpr?.responseReason || payJson?.responseReason || '').trim().toLowerCase();
    const txnStatus = String(bpr?.txnStatus || payJson?.txnStatus || '').trim().toUpperCase();
    const txnRefId = bpr?.txnRefId || bpr?.billerResponse?.txnRefId || payJson?.txnRefId;
    const hasCC01 = !!(txnRefId && String(txnRefId).toUpperCase().startsWith('CC01'));

    const errorObj = bpr?.errorInfo?.error || payJson?.errorInfo?.error || bpr?.errorInfo || payJson?.errorInfo;
    const errorCode = String(errorObj?.errorCode || bpr?.errorCode || payJson?.errorCode || '').trim().toUpperCase();
    const errorMessage = String(errorObj?.errorMessage || bpr?.errorMessage || payJson?.errorMessage || bpr?.reason || payJson?.reason || '').trim();

    // Pending / In-progress detection (matches BillAvenue specs & B2C logic):
    // 1. responseCode 999, 001, or 'pending'
    // 2. responseReason 'awaited' or 'pending'
    // 3. errorCode PWB001 (Currently request in progress), PNR001, TIMEOUT
    // 4. In-progress message description
    const isSuccess = 
      txnStatus === 'SUCCESS' || 
      txnStatus === 'APPROVED' || 
      rawResponseCode === '000' || 
      rawResponseCode === '0000' || 
      rawResponseReason === 'successful' || 
      rawResponseReason === 'success';

    const isPending = 
      !isSuccess && (
        rawResponseCode === '999' || 
        rawResponseCode === '001' ||
        rawResponseCode.toLowerCase() === 'pending' ||
        rawResponseReason === 'awaited' || 
        rawResponseReason === 'pending' ||
        txnStatus === 'PENDING' ||
        txnStatus === 'AWAITED' ||
        errorCode === 'PNR001' || 
        errorCode === 'PWB001' || 
        errorCode === 'TIMEOUT' ||
        errorMessage.toLowerCase().includes('in progress') ||
        errorMessage.toLowerCase().includes('check the status after some time') ||
        (hasCC01 && txnStatus !== 'FAILED' && txnStatus !== 'FAILURE' && txnStatus !== 'REJECTED')
      );

    let finalStatus = 'pending';
    if (isSuccess) {
      finalStatus = 'success';
    } else if (isPending) {
      finalStatus = 'pending';
      // DO NOT refund wallet! Money remains deducted because the bill is actively being processed by BillAvenue & biller.
      console.log(`[B2B PayBill - PENDING] Transaction ${customTxnId} is PENDING / AWAITED at BillAvenue (Ref: ${txnRefId || 'N/A'}).`);
    } else {
      finalStatus = 'failed';
      // Initiate refund ONLY when truly FAILED (Refund total including charge)
      await supabaseAdmin.rpc('add_b2b_wallet_balance', { p_agent_id: agentId, p_amount: totalDeduction });
      console.log(`[B2B PayBill - REFUND] Refunded ₹${totalDeduction} to agent ${agentId} due to FAILED status from BillAvenue.`);
    }

    console.log(`[B2B PayBill - FINAL STATUS] ${finalStatus.toUpperCase()} for txn ${customTxnId}`);

    // Update log
    if (logId) {
      const updatePayload: any = {
        status_code: finalStatus === 'success' ? 200 : (finalStatus === 'pending' ? 202 : 500),
        payment_status: finalStatus,
        developer_charge: finalStatus === 'success' ? developerCharge : (finalStatus === 'pending' ? developerCharge : 0),
        owner_charge: finalStatus === 'success' ? ownerCharge : (finalStatus === 'pending' ? ownerCharge : 0),
        charge_deducted: finalStatus === 'success' ? chargePerBill : 0,
        response_payload: { 
          ...payJson, 
          finalStatus, 
          payment_status: finalStatus, 
          transaction_id: bbpsuTxnId, 
          api_txn_id: bbpsuTxnId,
          client_transaction_id: customTxnId,
          bbps_txn_ref_id: bbpsuTxnId,
          requestId: billavenueRequestId 
        }
      };
      // Only log the charge as deducted and credit profit if payment is successful
      if (finalStatus === 'success') {
        // Credit the API charge to the Admin's Profit Balance
        if (chargePerBill > 0) {
          await supabaseAdmin.rpc('add_admin_balance', { p_amount: chargePerBill });
          console.log(`[B2B PayBill - ADMIN PROFIT] Credited ₹${chargePerBill} to admin balance for successful bill.`);
        }
      }
      await supabaseAdmin.from('b2b_api_logs').update(updatePayload).eq('id', logId);
    }

    const httpStatusCode = finalStatus === 'success' ? 200 : (finalStatus === 'pending' ? 202 : 400);

    return res.status(httpStatusCode).json({
      status: finalStatus,
      message: finalStatus === 'success' 
        ? 'Bill Paid successfully' 
        : (finalStatus === 'pending' ? 'Transaction initiated, currently pending at biller' : (errorMessage || 'Payment failed')),
      data: {
        ...payJson,
        transaction_id: bbpsuTxnId,
        api_txn_id: bbpsuTxnId,
        client_transaction_id: customTxnId,
        bbps_txn_ref_id: bbpsuTxnId,
        status: finalStatus,
        payment_status: finalStatus
      },
      transaction_id: bbpsuTxnId,
      api_txn_id: bbpsuTxnId,
      client_transaction_id: customTxnId,
      bbps_txn_ref_id: bbpsuTxnId,
      payment_status: finalStatus,
      charge_deducted: finalStatus === 'success' ? chargePerBill : 0,
      refunded: finalStatus === 'failed',
      refunded_amount: finalStatus === 'failed' ? totalDeduction : 0
    });

    // Fire webhook asynchronously
    if (agentData?.webhook_url && agentData.webhook_url.startsWith('http')) {
      const webhookPayload = {
        event: 'PAYMENT_STATUS_UPDATE',
        transaction_id: bbpsuTxnId,
        api_txn_id: bbpsuTxnId,
        client_transaction_id: customTxnId,
        bbps_txn_ref_id: bbpsuTxnId,
        status: finalStatus,
        amount: parsedAmount,
        bbps_status: bpr?.txnStatus?.toUpperCase() || '',
        timestamp: new Date().toISOString()
      };
      
      // Async fetch without awaiting to not block the API response
      fetch(agentData.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      })
      .then(async (webhookRes) => {
        const responseBody = await webhookRes.text();
        await supabaseAdmin.from('b2b_webhook_logs').insert({
          agent_id: agentId,
          transaction_id: bbpsuTxnId,
          webhook_url: agentData.webhook_url,
          payload: webhookPayload,
          response_status: webhookRes.status,
          response_body: responseBody
        });
      })
      .catch(async (webhookError) => {
        await supabaseAdmin.from('b2b_webhook_logs').insert({
          agent_id: agentId,
          transaction_id: bbpsuTxnId,
          webhook_url: agentData.webhook_url,
          payload: webhookPayload,
          error_message: webhookError.message
        });
      });
    }

  } catch (err: any) {
    console.error('[B2B PayBill - FATAL EXCEPTION]', err);
    res.status(500).json({ status: 'error', message: err.message || 'Internal Server Error' });
  }
};

/**
 * Create B2B Fund Request via API
 */
export const createFundRequest = async (req: Request, res: Response): Promise<any> => {
  try {
    const agentId = (req as any).agentId;
    const { amount, utr_number, transaction_ref_no, proof_url, admin_bank_account_id, bank_account_id, wallet_type } = req.body;

    const reqUtr = String(utr_number || transaction_ref_no || '').trim();
    const reqAmount = Number(amount);
    const bankId = String(admin_bank_account_id || bank_account_id || '').trim();
    const targetWalletType = String(wallet_type || 'bbps').toLowerCase() === 'payout' ? 'payout' : 'bbps';

    if (!reqAmount || isNaN(reqAmount) || reqAmount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid amount is required' });
    }

    if (!reqUtr) {
      return res.status(400).json({ status: 'error', message: 'utr_number or transaction_ref_no is required' });
    }

    // If requesting payout wallet, verify agent has Payout service enabled
    if (targetWalletType === 'payout') {
      const { data: credCheck } = await supabaseAdmin
        .from('b2b_api_credentials')
        .select('is_payout_enabled')
        .eq('id', agentId)
        .single();

      if (credCheck && credCheck.is_payout_enabled === false) {
        return res.status(403).json({
          status: 'error',
          message: 'Payout API service is not enabled for your account. Cannot request funds for Payout Wallet.'
        });
      }
    }

    // Check if a fund request with this UTR already exists in pending or approved status
    const { data: existingUtr } = await supabaseAdmin
      .from('b2b_fund_requests')
      .select('id, status, utr_number, amount, created_at')
      .ilike('utr_number', reqUtr)
      .in('status', ['pending', 'approved'])
      .limit(1)
      .maybeSingle();

    if (existingUtr) {
      return res.status(400).json({
        status: 'error',
        message: `Duplicate UTR detected! A fund request with UTR "${reqUtr}" has already been submitted and is currently ${existingUtr.status.toUpperCase()}. Duplicate submissions are blocked.`
      });
    }

    let targetBankId: string | null = null;
    let targetBankDetails: any = null;

    // If bankId is provided, fetch bank details
    if (bankId) {
      const { data: bankData } = await supabaseAdmin
        .from('b2b_admin_bank_accounts')
        .select('*')
        .eq('id', bankId)
        .single();

      if (bankData) {
        targetBankId = bankData.id;
        targetBankDetails = {
          bank_name: bankData.bank_name,
          account_name: bankData.account_name,
          account_number: bankData.account_number,
          ifsc_code: bankData.ifsc_code,
          upi_id: bankData.upi_id || null
        };
      }
    }

    // Fallback: If no bankId passed, assign default active Admin Bank Account
    if (!targetBankDetails) {
      const { data: defaultBank } = await supabaseAdmin
        .from('b2b_admin_bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (defaultBank) {
        targetBankId = defaultBank.id;
        targetBankDetails = {
          bank_name: defaultBank.bank_name,
          account_name: defaultBank.account_name,
          account_number: defaultBank.account_number,
          ifsc_code: defaultBank.ifsc_code,
          upi_id: defaultBank.upi_id || null
        };
      }
    }

    // Insert into b2b_fund_requests
    const { data: requestData, error: insertError } = await supabaseAdmin
      .from('b2b_fund_requests')
      .insert({
        agent_id: agentId,
        amount: reqAmount,
        utr_number: reqUtr,
        proof_url: proof_url || null,
        admin_bank_account_id: targetBankId,
        admin_bank_details: targetBankDetails,
        wallet_type: targetWalletType,
        status: 'pending'
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    // 💬 Trigger WhatsApp notification to Admin
    try {
      let agentName = 'B2B Agent';
      let agentPhone = 'N/A';

      // 1. Fetch agent details from b2b_api_credentials, b2b_agents, or users_profiles
      const { data: b2bCred } = await supabaseAdmin
        .from('b2b_api_credentials')
        .select('*')
        .eq('id', agentId)
        .maybeSingle();

      if (b2bCred) {
        const fullName = [b2bCred.first_name, b2bCred.last_name].filter(Boolean).join(' ').trim();
        agentName = fullName || b2bCred.company_name || b2bCred.name || b2bCred.b2b_login_id || agentName;
        agentPhone = b2bCred.mobile || b2bCred.phone || agentPhone;
      } else {
        const { data: agentData } = await supabaseAdmin
          .from('b2b_agents')
          .select('company_name, full_name, phone, mobile')
          .eq('id', agentId)
          .maybeSingle();

        if (agentData) {
          agentName = agentData.company_name || agentData.full_name || agentName;
          agentPhone = agentData.phone || agentData.mobile || agentPhone;
        } else {
          const { data: userProfile } = await supabaseAdmin
            .from('users_profiles')
            .select('full_name, mobile, phone')
            .eq('id', agentId)
            .maybeSingle();

          if (userProfile) {
            agentName = userProfile.full_name || agentName;
            agentPhone = userProfile.mobile || userProfile.phone || agentPhone;
          }
        }
      }

      // 2. Load configured admin WhatsApp numbers from payout_settings DB if needed
      let targetAdminPhones: string | undefined = undefined;
      const { data: set } = await supabaseAdmin
        .from('payout_settings')
        .select('b2b_whatsapp_numbers')
        .eq('id', 1)
        .maybeSingle();

      if (set && set.b2b_whatsapp_numbers) {
        targetAdminPhones = set.b2b_whatsapp_numbers;
      }

      notifyAdminNewB2BFundRequest({
        agentName,
        agentPhone,
        amount: Number(requestData.amount),
        utr: requestData.utr_number,
        mode: (targetBankDetails as any)?.bank_name || 'Bank Transfer',
        proofUrl: requestData.proof_url || proof_url || undefined,
        adminPhone: targetAdminPhones
      }).catch((err: any) => console.error('[WhatsApp Admin Notify Error]', err));
    } catch (wsErr) {
      console.error('[WhatsApp Trigger Error]', wsErr);
    }

    // Log the API call in b2b_api_logs
    await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/v1/b2b/fund-request',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: req.body,
        status_code: 201,
        response_payload: { message: 'Fund request created', request_id: requestData.id, status: 'pending' }
      });

    return res.status(201).json({
      status: 'success',
      message: 'Fund request submitted successfully and pending approval',
      data: {
        request_id: requestData.id,
        amount: Number(requestData.amount),
        utr_number: requestData.utr_number,
        wallet_type: requestData.wallet_type || targetWalletType,
        admin_bank_details: targetBankDetails,
        status: requestData.status,
        submitted_at: requestData.created_at
      }
    });

  } catch (err: any) {
    console.error('[B2B createFundRequest Error]', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to submit fund request' });
  }
};

/**
 * Check B2B Fund Request Status via API
 */
export const getFundRequestStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const agentId = (req as any).agentId;
    const { request_id } = req.params;

    if (!request_id) {
      return res.status(400).json({ status: 'error', message: 'request_id parameter is required' });
    }

    const { data: requestData, error } = await supabaseAdmin
      .from('b2b_fund_requests')
      .select('*')
      .eq('id', request_id)
      .eq('agent_id', agentId)
      .single();

    if (error || !requestData) {
      return res.status(404).json({ status: 'error', message: 'Fund request not found for this agent' });
    }

    return res.json({
      status: 'success',
      data: {
        request_id: requestData.id,
        amount: Number(requestData.amount),
        utr_number: requestData.utr_number,
        wallet_type: requestData.wallet_type || 'bbps',
        status: requestData.status,
        proof_url: requestData.proof_url || null,
        created_at: requestData.created_at,
        updated_at: requestData.updated_at
      }
    });

  } catch (err: any) {
    console.error('[B2B getFundRequestStatus Error]', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch fund request status' });
  }
};

/**
 * List B2B Fund Requests via API
 */
export const getFundRequests = async (req: Request, res: Response): Promise<any> => {
  try {
    const agentId = (req as any).agentId;
    const { status, limit = '50', page = '1' } = req.query;

    let pageNum = parseInt(page as string, 10) || 1;
    let limitNum = parseInt(limit as string, 10) || 50;
    if (limitNum > 100) limitNum = 100;

    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabaseAdmin
      .from('b2b_fund_requests')
      .select('*', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', String(status).toLowerCase());
    }

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    return res.json({
      status: 'success',
      data: (data || []).map(r => ({
        request_id: r.id,
        amount: Number(r.amount),
        utr_number: r.utr_number,
        wallet_type: r.wallet_type || 'bbps',
        status: r.status,
        proof_url: r.proof_url || null,
        created_at: r.created_at
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total_records: count || 0,
        total_pages: count ? Math.ceil(count / limitNum) : 0
      }
    });

  } catch (err: any) {
    console.error('[B2B getFundRequests Error]', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch fund requests' });
  }
};

/**
 * Get Active Admin Bank Accounts List via API
 */
export const getAdminBankAccounts = async (req: Request, res: Response): Promise<any> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('b2b_admin_bank_accounts')
      .select('id, bank_name, account_name, account_number, ifsc_code, branch_name, upi_id')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error && error.code !== 'PGRST205') throw error;

    return res.json({
      status: 'success',
      data: (data || []).map(b => ({
        bank_account_id: b.id,
        bank_name: b.bank_name,
        account_name: b.account_name,
        account_number: b.account_number,
        ifsc_code: b.ifsc_code,
        branch_name: b.branch_name || null,
        upi_id: b.upi_id || null
      }))
    });

  } catch (err: any) {
    console.error('[B2B getAdminBankAccounts Error]', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch admin bank accounts' });
  }
};

/**
 * Helper to calculate partner payout fee from custom slabs or global default slabs
 */
const calculatePartnerPayoutFee = (amount: number, customSlabsRaw?: any): { fee: number; slab: any; error?: string } => {
  let customSlabs: any[] = [];
  if (customSlabsRaw) {
    if (Array.isArray(customSlabsRaw)) {
      customSlabs = customSlabsRaw;
    } else if (typeof customSlabsRaw === 'string') {
      try {
        customSlabs = JSON.parse(customSlabsRaw);
      } catch (e) {
        customSlabs = [];
      }
    }
  }

  // 1. If agent has custom slabs configured, STRICTLY enforce their custom slabs
  if (Array.isArray(customSlabs) && customSlabs.length > 0) {
    const activeSlabs = customSlabs.filter(s => s.is_active !== false);
    if (activeSlabs.length > 0) {
      const sorted = [...activeSlabs].sort((a, b) => Number(a.min_amount) - Number(b.min_amount));
      const minAllowed = Number(sorted[0].min_amount);
      const maxAllowed = Number(sorted[sorted.length - 1].max_amount);

      if (amount < minAllowed) {
        return {
          fee: 0,
          slab: null,
          error: `Minimum payout transfer amount allowed for your account is ₹${minAllowed.toLocaleString('en-IN')}. Requested amount: ₹${amount.toLocaleString('en-IN')}.`
        };
      }

      if (amount > maxAllowed) {
        return {
          fee: 0,
          slab: null,
          error: `Maximum payout transfer amount allowed per transaction for your account is ₹${maxAllowed.toLocaleString('en-IN')}. Requested amount: ₹${amount.toLocaleString('en-IN')}.`
        };
      }

      for (const slab of sorted) {
        if (amount >= Number(slab.min_amount) && amount <= Number(slab.max_amount)) {
          const fee = slab.charge_type === 'percentage'
            ? Math.round(((amount * Number(slab.charge_value)) / 100) * 100) / 100
            : Number(slab.charge_value);
          return { fee: Math.max(0, fee), slab };
        }
      }

      // If amount falls into an unconfigured gap between active slabs
      return {
        fee: 0,
        slab: null,
        error: `No payout fee slab is configured for amount ₹${amount.toLocaleString('en-IN')}. Allowed range is ₹${minAllowed.toLocaleString('en-IN')} to ₹${maxAllowed.toLocaleString('en-IN')}. Please contact administrator.`
      };
    }
  }

  // 2. If agent has NO custom slabs, check Global Slabs from Nixasoft config
  const globalConfig = getNixasoftConfig();
  const globalActiveSlabs = (globalConfig.slabs || []).filter(s => s.is_active !== false);
  if (globalActiveSlabs.length > 0) {
    const sorted = [...globalActiveSlabs].sort((a, b) => Number(a.min_amount) - Number(b.min_amount));
    const minAllowed = Number(sorted[0].min_amount);
    const maxAllowed = Number(sorted[sorted.length - 1].max_amount);

    if (amount < minAllowed) {
      return {
        fee: 0,
        slab: null,
        error: `Minimum payout transfer amount allowed is ₹${minAllowed.toLocaleString('en-IN')}. Requested amount: ₹${amount.toLocaleString('en-IN')}.`
      };
    }

    if (amount > maxAllowed) {
      return {
        fee: 0,
        slab: null,
        error: `Maximum payout transfer amount allowed is ₹${maxAllowed.toLocaleString('en-IN')}. Requested amount: ₹${amount.toLocaleString('en-IN')}.`
      };
    }

    for (const slab of sorted) {
      if (amount >= Number(slab.min_amount) && amount <= Number(slab.max_amount)) {
        const fee = slab.charge_type === 'percentage'
          ? Math.round(((amount * Number(slab.charge_value)) / 100) * 100) / 100
          : Number(slab.charge_value);
        return { fee: Math.max(0, fee), slab };
      }
    }

    return {
      fee: 0,
      slab: null,
      error: `No payout fee slab is configured for amount ₹${amount.toLocaleString('en-IN')}. Allowed range is ₹${minAllowed.toLocaleString('en-IN')} to ₹${maxAllowed.toLocaleString('en-IN')}. Please contact administrator.`
    };
  }

  const fallback = calculateSlabCharge(amount);
  return { fee: fallback.charge, slab: fallback.slab };
};

export const firePayoutWebhook = (webhookUrl: string | null | undefined, agentId: string, payload: any) => {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    console.log(`[B2B Payout Webhook Skipped] No valid webhook URL for agent ${agentId}`);
    return;
  }
  console.log(`[B2B Payout Webhook] Dispatching to ${webhookUrl} for order ${payload.order_id}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal
  })
  .then(async (res) => {
    clearTimeout(timeoutId);
    const resText = await res.text();
    console.log(`[B2B Payout Webhook Response] HTTP ${res.status} from ${webhookUrl}`);
    await supabaseAdmin.from('b2b_webhook_logs').insert({
      agent_id: agentId,
      transaction_id: payload.order_id,
      webhook_url: webhookUrl,
      payload,
      response_status: res.status,
      response_body: resText.substring(0, 1000)
    });
  })
  .catch(async (err: any) => {
    clearTimeout(timeoutId);
    console.error(`[B2B Payout Webhook Error] Failed to deliver to ${webhookUrl}:`, err.message);
    await supabaseAdmin.from('b2b_webhook_logs').insert({
      agent_id: agentId,
      transaction_id: payload.order_id,
      webhook_url: webhookUrl,
      payload,
      error_message: err.message
    });
  });
};

/**
 * Atomic Payout Refund Guard
 * Prevents race conditions and double refunds across API failures, Nixasoft Webhook callbacks, and Background Cron reconciliations.
 * Guarantees that a payout is refunded ONCE and ONLY ONCE.
 */
export const atomicRefundB2BPayout = async (
  orderId: string, 
  failReason: string = 'Bank transaction declined',
  responsePayload: any = null
): Promise<{ success: boolean; alreadyRefunded: boolean; message: string; refundedAmount?: number; agentId?: string }> => {
  if (!orderId) {
    return { success: false, alreadyRefunded: false, message: 'Missing order_id' };
  }

  // 1. Try atomic PostgreSQL RPC if deployed
  try {
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('refund_b2b_payout_atomic', {
      p_order_id: orderId,
      p_reason: failReason
    });

    if (!rpcErr && rpcRes) {
      if (rpcRes.success) {
        console.log(`[Atomic Refund Guard] Successfully refunded order ${orderId} via RPC: ₹${rpcRes.refund_amount}`);
        return { 
          success: true, 
          alreadyRefunded: false, 
          message: 'Refunded successfully',
          refundedAmount: Number(rpcRes.refund_amount || 0),
          agentId: rpcRes.agent_id
        };
      }
      if (rpcRes.already_processed) {
        console.warn(`[Atomic Refund Guard] Blocked duplicate refund for order ${orderId}. Current status: ${rpcRes.current_status}`);
        return { success: false, alreadyRefunded: true, message: rpcRes.message };
      }
    }
  } catch (err: any) {
    // RPC may not be present in DB yet, fallback below
  }

  // 2. Atomic Fallback: Conditional update directly on postgres
  // CRITICAL: We atomically update status from 'pending' -> 'failed'
  // If another thread (webhook callback or cron) already transitioned it to 'failed',
  // this update will match ZERO rows and return empty array!
  const updateData: any = {
    status: 'failed',
    error_message: failReason,
    is_refunded: true,
    refunded_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (responsePayload) {
    updateData.response_payload = responsePayload;
  }

  let updatedTxs: any[] | null = null;
  let updateErr: any = null;

  const primaryUpdate = await supabaseAdmin
    .from('b2b_payout_transactions')
    .update(updateData)
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .select('id, agent_id, total_deducted');

  updatedTxs = primaryUpdate.data;
  updateErr = primaryUpdate.error;

  // Fallback if is_refunded / refunded_at columns not yet in DB schema cache
  if (updateErr && (updateErr.message?.includes('is_refunded') || updateErr.code === 'PGRST204')) {
    delete updateData.is_refunded;
    delete updateData.refunded_at;
    const fallbackUpdate = await supabaseAdmin
      .from('b2b_payout_transactions')
      .update(updateData)
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .select('id, agent_id, total_deducted');
    updatedTxs = fallbackUpdate.data;
    updateErr = fallbackUpdate.error;
  }

  if (updateErr) {
    console.error(`[Atomic Refund Guard] Error during conditional update for ${orderId}:`, updateErr.message);
    return { success: false, alreadyRefunded: false, message: updateErr.message };
  }

  if (!updatedTxs || updatedTxs.length === 0) {
    console.warn(`[Atomic Refund Guard] Blocked duplicate refund for order ${orderId}. Transaction is not pending or was already processed.`);
    return { 
      success: false, 
      alreadyRefunded: true, 
      message: 'Transaction already resolved. Double refund prevented!' 
    };
  }

  const tx = updatedTxs[0];
  const refundAmount = Number(tx.total_deducted || 0);

  // Credit agent payout wallet ONCE and ONLY ONCE
  await supabaseAdmin.rpc('add_b2b_payout_wallet', {
    p_agent_id: tx.agent_id,
    p_amount: refundAmount
  });

  console.log(`[Atomic Refund Guard] Successfully refunded ₹${refundAmount} to agent ${tx.agent_id} for order ${orderId}`);
  return {
    success: true,
    alreadyRefunded: false,
    message: 'Refund processed successfully',
    refundedAmount: refundAmount,
    agentId: tx.agent_id
  };
};

/**
 * Execute B2B Instant Payout Transfer
 * Endpoint: POST /api/b2b/payout/transfer
 */
export const transferPayout = async (req: Request, res: Response): Promise<any> => {
  const agentId = (req as any).agentId;
  const {
    amount,
    account_number,
    ifsc_code,
    beneficiary_name,
    bank_name,
    transfer_mode = 'IMPS',
    client_order_id,
    mobile_number,
    email,
    webhook_url: reqWebhookUrl,
    callback_url: reqCallbackUrl
  } = req.body;

  try {
    // 1. Verify agent and check is_payout_enabled
    const { data: agent, error: agentErr } = await supabaseAdmin
      .from('b2b_api_credentials')
      .select('id, first_name, last_name, mobile, is_payout_enabled, payout_wallet_balance, payout_slabs, webhook_url')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized agent credentials' });
    }

    if (agent.is_payout_enabled === false) {
      return res.status(403).json({
        status: 'error',
        message: 'Payout API service is currently not enabled for your account. Please contact Administrator.'
      });
    }

    const targetWebhookUrl = String(reqWebhookUrl || reqCallbackUrl || agent.webhook_url || '').trim();

    // Auto-save webhook URL to agent profile if passed in payload and not yet configured in DB
    if ((reqWebhookUrl || reqCallbackUrl) && targetWebhookUrl && !agent.webhook_url) {
      try {
        await supabaseAdmin
          .from('b2b_api_credentials')
          .update({ webhook_url: targetWebhookUrl })
          .eq('id', agentId);
        console.log(`[B2B Auto-Saved Webhook URL] ${targetWebhookUrl} for agent ${agentId}`);
      } catch (saveErr) {
        console.error('[B2B Auto-Save Webhook URL Error]', saveErr);
      }
    }

    // 2. Validate parameters
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid amount. Payout transfer amount must be greater than ₹0.'
      });
    }

    const cleanAccount = String(account_number || '').trim();
    if (!cleanAccount || cleanAccount.length < 8 || cleanAccount.length > 22) {
      return res.status(400).json({ status: 'error', message: 'Valid account_number is required (8-22 digits)' });
    }

    const cleanIfsc = String(ifsc_code || '').trim().toUpperCase();
    if (!cleanIfsc || cleanIfsc.length !== 11) {
      return res.status(400).json({ status: 'error', message: 'Valid 11-character ifsc_code is required' });
    }

    const cleanName = String(beneficiary_name || '').trim();
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ status: 'error', message: 'Valid beneficiary_name is required' });
    }

    const cleanClientOrderId = String(client_order_id || '').trim();

    // 3. Idempotency Check
    if (cleanClientOrderId) {
      const { data: existingTx } = await supabaseAdmin
        .from('b2b_payout_transactions')
        .select('*')
        .eq('agent_id', agentId)
        .eq('client_order_id', cleanClientOrderId)
        .maybeSingle();

      if (existingTx) {
        return res.status(200).json({
          status: existingTx.status,
          message: `Transaction already processed with client_order_id: ${cleanClientOrderId}`,
          data: {
            order_id: existingTx.order_id,
            client_order_id: existingTx.client_order_id,
            utr: existingTx.utr || null,
            amount: Number(existingTx.amount),
            fee: Number(existingTx.fee),
            status: existingTx.status,
            created_at: existingTx.created_at
          }
        });
      }
    }

    // 4. Calculate Slabs Fee + 18% GST (Applicable only for Payout)
    const slabResult = calculatePartnerPayoutFee(parsedAmount, agent.payout_slabs);
    if (slabResult.error) {
      await supabaseAdmin.from('b2b_api_logs').insert({
        agent_id: agentId,
        endpoint: '/api/b2b/payout/transfer',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: { client_order_id: cleanClientOrderId, amount: parsedAmount, beneficiary_name: cleanName, account_number: cleanAccount, ifsc_code: cleanIfsc },
        status_code: 400,
        payment_status: 'failed',
        response_payload: { status: 'error', message: slabResult.error }
      });
      return res.status(400).json({
        status: 'error',
        message: slabResult.error
      });
    }

    const rawSlabFee = slabResult.fee;
    const baseFee = Math.round(rawSlabFee * 100) / 100;
    const gstRate = 0.18; // 18% GST on slab charge
    const gstAmount = Math.round((baseFee * gstRate) * 100) / 100;
    const totalFee = Math.round((baseFee + gstAmount) * 100) / 100;
    const totalDeduction = Math.round((parsedAmount + totalFee) * 100) / 100;
    const currentPayoutBalance = Number(agent.payout_wallet_balance || 0);

    if (currentPayoutBalance < totalDeduction) {
      return res.status(400).json({
        status: 'error',
        message: `Insufficient Payout Wallet balance. Required: ₹${totalDeduction.toFixed(2)} (Amount: ₹${parsedAmount.toFixed(2)} + Base Fee: ₹${baseFee.toFixed(2)} + 18% GST: ₹${gstAmount.toFixed(2)}), Available in Payout Wallet: ₹${currentPayoutBalance.toFixed(2)}. Please submit a fund request for your Payout Wallet.`,
        data: {
          required_balance: totalDeduction,
          current_payout_balance: currentPayoutBalance,
          transfer_amount: parsedAmount,
          base_fee: baseFee,
          gst: gstAmount,
          fee: totalFee
        }
      });
    }

    // 5. Deduct from Payout Wallet atomically
    const { data: deductOk, error: deductErr } = await supabaseAdmin.rpc('deduct_b2b_payout_wallet', {
      p_agent_id: agentId,
      p_amount: totalDeduction
    });

    if (deductErr || !deductOk) {
      return res.status(400).json({
        status: 'error',
        message: 'Could not deduct funds from Payout Wallet. Transaction cancelled.'
      });
    }

    // 6. Generate unique Order ID
    const orderId = 'B2BPO' + Date.now() + Math.floor(1000 + Math.random() * 9000);
    const cleanMode = String(transfer_mode).toUpperCase() === 'NEFT' ? 'NEFT' : 'IMPS';

    const resolvedMobile = String(
      mobile_number || 
      req.body.mobile || 
      req.body.mobileNumber || 
      req.body.phone || 
      agent.mobile || 
      '9999999999'
    ).trim().replace(/\D/g, '').slice(-10) || '9999999999';

    const resolvedEmail = String(
      email || 
      req.body.emailId || 
      req.body.email_id || 
      'b2b@usepay.in'
    ).trim();

    // 7. Insert Initial Transaction
    const baseTxRecord: any = {
      agent_id: agentId,
      order_id: orderId,
      account_number: cleanAccount,
      ifsc_code: cleanIfsc,
      beneficiary_name: cleanName,
      bank_name: bank_name || 'Bank',
      transfer_mode: cleanMode,
      amount: parsedAmount,
      charge: totalFee,
      total_deducted: totalDeduction,
      status: 'pending',
      request_payload: {
        client_order_id: cleanClientOrderId || null,
        mobile_number: resolvedMobile,
        email: resolvedEmail,
        base_fee: baseFee,
        gst_amount: gstAmount,
        gst_rate: '18%',
        total_fee: totalFee
      }
    };

    let insertTxErr: any = null;
    const primaryInsert = await supabaseAdmin
      .from('b2b_payout_transactions')
      .insert({
        ...baseTxRecord,
        client_order_id: cleanClientOrderId || null,
        gst_amount: gstAmount,
        base_charge: baseFee
      });

    insertTxErr = primaryInsert.error;

    // Fallback if gst_amount, base_charge or client_order_id columns do not exist in DB schema cache
    if (insertTxErr) {
      const fallbackInsert1 = await supabaseAdmin
        .from('b2b_payout_transactions')
        .insert({
          ...baseTxRecord,
          client_order_id: cleanClientOrderId || null
        });
      insertTxErr = fallbackInsert1.error;
      if (insertTxErr && (insertTxErr.message?.includes('client_order_id') || insertTxErr.code === 'PGRST204')) {
        const fallbackInsert2 = await supabaseAdmin
          .from('b2b_payout_transactions')
          .insert(baseTxRecord);
        insertTxErr = fallbackInsert2.error;
      }
    }

    if (insertTxErr) {
      console.error('[B2B Payout] Failed to insert initial transaction record:', insertTxErr);
      // Auto-refund immediately
      await supabaseAdmin.rpc('add_b2b_payout_wallet', { p_agent_id: agentId, p_amount: totalDeduction });
      return res.status(500).json({ 
        status: 'error', 
        message: 'Failed to initialize payout transaction record',
        detail: insertTxErr.message || insertTxErr 
      });
    }

    // 8. Execute Upstream Transfer via InstaPay
    const payoutResult = await executeNixasoftPayout({
      amount: String(parsedAmount),
      mobileNumber: resolvedMobile,
      requestId: orderId,
      accountNumber: cleanAccount,
      ifscCode: cleanIfsc,
      beneficiaryName: cleanName,
      bankName: bank_name || 'Bank',
      transferMode: cleanMode,
      emailId: resolvedEmail,
      latitude: '23.0225',
      longitude: '72.5714'
    });

    // 9. Update Transaction and Handle Results
    if (payoutResult.statuscode === 'TXN') {
      // SUCCESS
      const utr = payoutResult.data?.utr || null;
      const apiTxnId = payoutResult.data?.apiTxnId || null;

      await supabaseAdmin
        .from('b2b_payout_transactions')
        .update({
          status: 'success',
          utr,
          api_txn_id: apiTxnId,
          response_payload: payoutResult,
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId);

      // Fire payout webhook asynchronously
      firePayoutWebhook(targetWebhookUrl, agentId, {
        event: 'PAYOUT_STATUS_UPDATE',
        order_id: orderId,
        client_order_id: cleanClientOrderId || null,
        utr,
        status: 'success',
        amount: parsedAmount,
        base_fee: baseFee,
        gst: gstAmount,
        fee: totalFee,
        total_deducted: totalDeduction,
        beneficiary_name: cleanName,
        account_number: cleanAccount,
        ifsc_code: cleanIfsc,
        timestamp: new Date().toISOString()
      });

      // Log to b2b_api_logs
      await supabaseAdmin.from('b2b_api_logs').insert({
        agent_id: agentId,
        endpoint: '/api/b2b/payout/transfer',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: { order_id: orderId, client_order_id: cleanClientOrderId, amount: parsedAmount, beneficiary_name: cleanName, account_number: cleanAccount, ifsc_code: cleanIfsc },
        status_code: 200,
        payment_status: 'success',
        response_payload: payoutResult
      });

      return res.json({
        status: 'success',
        message: 'Payout transfer completed successfully',
        data: {
          order_id: orderId,
          client_order_id: cleanClientOrderId || null,
          utr,
          amount: parsedAmount,
          base_fee: baseFee,
          gst: gstAmount,
          fee: totalFee,
          total_deducted: totalDeduction,
          beneficiary_name: cleanName,
          account_number: cleanAccount,
          ifsc_code: cleanIfsc,
          status: 'success'
        }
      });
    } else if (payoutResult.statuscode === 'TXP') {
      // PROCESSING / PENDING
      // Fast Settler: Wait 2.5 seconds and do 1 live check before declaring pending.
      // Often IMPS bank clearing responds within 2 seconds.
      let liveCheck: any = null;
      try {
        await new Promise(r => setTimeout(r, 2500));
        liveCheck = await checkNixasoftStatus(orderId);
      } catch (quickErr) {
        console.warn('[B2B Fast Check Warning]', quickErr);
      }

      if (liveCheck && liveCheck.statuscode === 'TXN') {
        const utr = liveCheck.data?.utr || null;
        const apiTxnId = liveCheck.data?.apiTxnId || null;

        await supabaseAdmin
          .from('b2b_payout_transactions')
          .update({
            status: 'success',
            utr,
            api_txn_id: apiTxnId,
            response_payload: liveCheck,
            updated_at: new Date().toISOString()
          })
          .eq('order_id', orderId);

        firePayoutWebhook(targetWebhookUrl, agentId, {
          event: 'PAYOUT_STATUS_UPDATE',
          order_id: orderId,
          client_order_id: cleanClientOrderId || null,
          utr,
          status: 'success',
          amount: parsedAmount,
          base_fee: baseFee,
          gst: gstAmount,
          fee: totalFee,
          total_deducted: totalDeduction,
          beneficiary_name: cleanName,
          account_number: cleanAccount,
          ifsc_code: cleanIfsc,
          timestamp: new Date().toISOString()
        });

        await supabaseAdmin.from('b2b_api_logs').insert({
          agent_id: agentId,
          endpoint: '/api/b2b/payout/transfer',
          request_ip: (req as any).clientIp || req.ip,
          request_payload: { order_id: orderId, client_order_id: cleanClientOrderId, amount: parsedAmount, beneficiary_name: cleanName, account_number: cleanAccount, ifsc_code: cleanIfsc },
          status_code: 200,
          payment_status: 'success',
          response_payload: liveCheck
        });

        return res.json({
          status: 'success',
          message: 'Payout transfer completed successfully',
          data: {
            order_id: orderId,
            client_order_id: cleanClientOrderId || null,
            utr,
            amount: parsedAmount,
            base_fee: baseFee,
            gst: gstAmount,
            fee: totalFee,
            total_deducted: totalDeduction,
            beneficiary_name: cleanName,
            account_number: cleanAccount,
            ifsc_code: cleanIfsc,
            status: 'success'
          }
        });
      } else if (liveCheck && liveCheck.statuscode === 'TXF') {
        const failReason = liveCheck.message || 'Bank transaction declined';
        await atomicRefundB2BPayout(orderId, failReason, liveCheck);

        firePayoutWebhook(targetWebhookUrl, agentId, {
          event: 'PAYOUT_STATUS_UPDATE',
          order_id: orderId,
          client_order_id: cleanClientOrderId || null,
          utr: null,
          status: 'failed',
          amount: parsedAmount,
          base_fee: baseFee,
          gst: gstAmount,
          fee: totalFee,
          total_deducted: totalDeduction,
          beneficiary_name: cleanName,
          account_number: cleanAccount,
          ifsc_code: cleanIfsc,
          failure_reason: failReason,
          timestamp: new Date().toISOString()
        });

        return res.status(400).json({
          status: 'failed',
          message: failReason,
          data: {
            order_id: orderId,
            client_order_id: cleanClientOrderId || null,
            amount: parsedAmount,
            status: 'failed'
          }
        });
      }

      // If still pending, save and let background cron auto-reconcile
      const apiTxnId = payoutResult.data?.apiTxnId || null;

      await supabaseAdmin
        .from('b2b_payout_transactions')
        .update({
          status: 'pending',
          api_txn_id: apiTxnId,
          response_payload: payoutResult,
          updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId);

      // Fire pending payout webhook asynchronously
      firePayoutWebhook(targetWebhookUrl, agentId, {
        event: 'PAYOUT_STATUS_UPDATE',
        order_id: orderId,
        client_order_id: cleanClientOrderId || null,
        utr: null,
        status: 'pending',
        amount: parsedAmount,
        base_fee: baseFee,
        gst: gstAmount,
        fee: totalFee,
        total_deducted: totalDeduction,
        beneficiary_name: cleanName,
        account_number: cleanAccount,
        ifsc_code: cleanIfsc,
        timestamp: new Date().toISOString()
      });

      // Log to b2b_api_logs
      await supabaseAdmin.from('b2b_api_logs').insert({
        agent_id: agentId,
        endpoint: '/api/b2b/payout/transfer',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: { order_id: orderId, client_order_id: cleanClientOrderId, amount: parsedAmount, beneficiary_name: cleanName, account_number: cleanAccount, ifsc_code: cleanIfsc },
        status_code: 202,
        payment_status: 'pending',
        response_payload: payoutResult
      });

      return res.status(202).json({
        status: 'pending',
        message: 'Payout transfer is currently being processed by the bank. Webhook will be delivered automatically upon completion.',
        data: {
          order_id: orderId,
          client_order_id: cleanClientOrderId || null,
          amount: parsedAmount,
          base_fee: baseFee,
          gst: gstAmount,
          fee: totalFee,
          total_deducted: totalDeduction,
          status: 'pending'
        }
      });
    } else {
      // FAILED -> ATOMIC AUTO REFUND!
      const failReason = payoutResult.message || 'Bank transaction declined';

      await atomicRefundB2BPayout(orderId, failReason, payoutResult);

      // Log to b2b_api_logs
      await supabaseAdmin.from('b2b_api_logs').insert({
        agent_id: agentId,
        endpoint: '/api/b2b/payout/transfer',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: { order_id: orderId, client_order_id: cleanClientOrderId, amount: parsedAmount, beneficiary_name: cleanName, account_number: cleanAccount, ifsc_code: cleanIfsc },
        status_code: 400,
        payment_status: 'failed',
        response_payload: payoutResult
      });

      // Fire failed payout webhook asynchronously
      firePayoutWebhook(targetWebhookUrl, agentId, {
        event: 'PAYOUT_STATUS_UPDATE',
        order_id: orderId,
        client_order_id: cleanClientOrderId || null,
        utr: null,
        status: 'failed',
        failure_reason: failReason,
        amount: parsedAmount,
        base_fee: baseFee,
        gst: gstAmount,
        fee: totalFee,
        refunded_to_payout_wallet: true,
        beneficiary_name: cleanName,
        account_number: cleanAccount,
        ifsc_code: cleanIfsc,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        status: 'failed',
        message: failReason,
        data: {
          order_id: orderId,
          client_order_id: cleanClientOrderId || null,
          amount: parsedAmount,
          base_fee: baseFee,
          gst: gstAmount,
          fee: totalFee,
          total_deducted: totalDeduction,
          refunded_to_payout_wallet: true,
          status: 'failed'
        }
      });
    }

  } catch (err: any) {
    console.error('[B2B transferPayout Fatal Error]', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Internal server error during payout' });
  }
};

/**
 * Check B2B Payout Transaction Status
 * Endpoint: GET /api/b2b/payout/status/:order_id
 */
export const getPayoutStatus = async (req: Request, res: Response): Promise<any> => {
  const agentId = (req as any).agentId;
  const { order_id } = req.params;

  if (!order_id) {
    return res.status(400).json({ status: 'error', message: 'order_id parameter is required' });
  }

  try {
    // 1. Find transaction by order_id or client_order_id safely
    let tx: any = null;
    let { data: primaryTx, error: txErr } = await supabaseAdmin
      .from('b2b_payout_transactions')
      .select('*')
      .eq('agent_id', agentId)
      .or(`order_id.eq.${order_id},client_order_id.eq.${order_id}`)
      .maybeSingle();

    if (txErr && (txErr.message?.includes('client_order_id') || txErr.code === 'PGRST204')) {
      const fallbackQuery = await supabaseAdmin
        .from('b2b_payout_transactions')
        .select('*')
        .eq('agent_id', agentId)
        .eq('order_id', order_id)
        .maybeSingle();
      primaryTx = fallbackQuery.data;
      txErr = fallbackQuery.error;
    }
    tx = primaryTx;

    if (txErr || !tx) {
      return res.status(404).json({ status: 'error', message: 'Payout transaction not found' });
    }

    // 2. If status is pending, re-check upstream status
    if (tx.status === 'pending') {
      try {
        const liveStatus = await checkNixasoftStatus(tx.order_id);
          const { data: cred } = await supabaseAdmin
            .from('b2b_api_credentials')
            .select('webhook_url')
            .eq('id', agentId)
            .maybeSingle();

          if (liveStatus.statuscode === 'TXN') {
            const utr = liveStatus.data?.utr || tx.utr;
            await supabaseAdmin
              .from('b2b_payout_transactions')
              .update({
                status: 'success',
                utr,
                api_txn_id: liveStatus.data?.apiTxnId || tx.api_txn_id,
                response_payload: liveStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', tx.id);
            tx.status = 'success';
            tx.utr = utr;

            if (cred?.webhook_url) {
              firePayoutWebhook(cred.webhook_url, agentId, {
                event: 'PAYOUT_STATUS_UPDATE',
                order_id: tx.order_id,
                client_order_id: tx.client_order_id || tx.request_payload?.client_order_id || null,
                utr,
                status: 'success',
                amount: Number(tx.amount),
                fee: Number(tx.charge || tx.fee || 0),
                total_deducted: Number(tx.total_deducted),
                beneficiary_name: tx.beneficiary_name,
                account_number: tx.account_number,
                ifsc_code: tx.ifsc_code,
                timestamp: new Date().toISOString()
              });
            }
          } else if (liveStatus.statuscode === 'TXF') {
            const failReason = liveStatus.message || 'Transaction failed after status inquiry';
            await atomicRefundB2BPayout(tx.order_id, failReason, liveStatus);
            tx.status = 'failed';
            tx.error_message = failReason;

            if (cred?.webhook_url) {
              firePayoutWebhook(cred.webhook_url, agentId, {
                event: 'PAYOUT_STATUS_UPDATE',
                order_id: tx.order_id,
                client_order_id: tx.client_order_id || tx.request_payload?.client_order_id || null,
                utr: null,
                status: 'failed',
                failure_reason: failReason,
                amount: Number(tx.amount),
                fee: Number(tx.charge || tx.fee || 0),
                refunded_to_payout_wallet: true,
                beneficiary_name: tx.beneficiary_name,
                account_number: tx.account_number,
                ifsc_code: tx.ifsc_code,
                timestamp: new Date().toISOString()
              });
            }
          }
      } catch (checkErr) {
        console.warn('[B2B getPayoutStatus] Upstream status check failed, returning DB status:', checkErr);
      }
    }

    return res.json({
      status: 'success',
      data: {
        order_id: tx.order_id,
        client_order_id: tx.client_order_id || tx.request_payload?.client_order_id || null,
        utr: tx.utr || null,
        beneficiary_name: tx.beneficiary_name,
        account_number: tx.account_number,
        ifsc_code: tx.ifsc_code,
        transfer_mode: tx.transfer_mode,
        amount: Number(tx.amount),
        base_fee: Number(tx.request_payload?.base_fee || tx.base_charge || Math.round((Number(tx.charge || tx.fee || 0) / 1.18) * 100) / 100),
        gst: Number(tx.request_payload?.gst_amount || tx.gst_amount || Math.round((Number(tx.charge || tx.fee || 0) - (Number(tx.charge || tx.fee || 0) / 1.18)) * 100) / 100),
        fee: Number(tx.charge || tx.fee || 0),
        total_deducted: Number(tx.total_deducted),
        status: tx.status,
        failure_reason: tx.error_message || tx.failure_reason || null,
        created_at: tx.created_at,
        updated_at: tx.updated_at
      }
    });

  } catch (err: any) {
    console.error('[B2B getPayoutStatus Error]', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to check payout status' });
  }
};

/**
 * Admin / Global Check Payout Status
 * Endpoint: GET /api/b2b/admin/payout/status/:order_id
 */
export const checkPayoutStatusAdmin = async (req: Request, res: Response): Promise<any> => {
  const { order_id } = req.params;

  if (!order_id) {
    return res.status(400).json({ status: 'error', message: 'order_id parameter is required' });
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id);
    let tx: any = null;
    let { data: primaryTx, error: txErr } = await supabaseAdmin
      .from('b2b_payout_transactions')
      .select('*')
      .or(`${isUuid ? `id.eq.${order_id},` : ''}order_id.eq.${order_id},client_order_id.eq.${order_id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (txErr && (txErr.message?.includes('client_order_id') || txErr.code === 'PGRST204')) {
      const fallbackQuery = await supabaseAdmin
        .from('b2b_payout_transactions')
        .select('*')
        .or(`${isUuid ? `id.eq.${order_id},` : ''}order_id.eq.${order_id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      primaryTx = fallbackQuery.data;
      txErr = fallbackQuery.error;
    }
    tx = primaryTx;

    if (txErr || !tx) {
      return res.status(404).json({ status: 'error', message: 'Payout transaction not found' });
    }

    // If pending, query gateway
    if (tx.status === 'pending') {
      try {
        const liveStatus = await checkNixasoftStatus(tx.order_id);
        if (liveStatus.statuscode === 'TXN') {
          const utr = liveStatus.data?.utr || tx.utr;
          await supabaseAdmin
            .from('b2b_payout_transactions')
            .update({
              status: 'success',
              utr,
              api_txn_id: liveStatus.data?.apiTxnId || tx.api_txn_id,
              response_payload: liveStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', tx.id);
          tx.status = 'success';
          tx.utr = utr;

          // Dispatch Webhook to Agent
          try {
            let targetWebhook = tx.request_payload?.webhook_url || tx.request_payload?.callback_url;
            if (!targetWebhook) {
              const { data: cred } = await supabaseAdmin
                .from('b2b_api_credentials')
                .select('webhook_url')
                .eq('id', tx.agent_id)
                .single();
              targetWebhook = cred?.webhook_url;
            }
            firePayoutWebhook(targetWebhook, tx.agent_id, {
              event: 'PAYOUT_STATUS_UPDATE',
              order_id: tx.order_id,
              client_order_id: tx.client_order_id || null,
              utr,
              status: 'success',
              amount: Number(tx.amount),
              base_fee: Number(tx.request_payload?.base_fee || tx.base_charge || Math.round((Number(tx.charge ?? tx.fee ?? 0) / 1.18) * 100) / 100),
              gst: Number(tx.request_payload?.gst_amount || tx.gst_amount || Math.round((Number(tx.charge ?? tx.fee ?? 0) - (Number(tx.charge ?? tx.fee ?? 0) / 1.18)) * 100) / 100),
              fee: Number(tx.charge ?? tx.fee ?? 0),
              total_deducted: Number(tx.total_deducted),
              beneficiary_name: tx.beneficiary_name,
              account_number: tx.account_number,
              ifsc_code: tx.ifsc_code,
              timestamp: new Date().toISOString()
            });
          } catch (hookErr) {
            console.warn('[B2B checkPayoutStatusAdmin] Webhook dispatch warning:', hookErr);
          }
        } else if (liveStatus.statuscode === 'TXF') {
          const failReason = liveStatus.message || 'Transaction failed after status inquiry';
          await atomicRefundB2BPayout(tx.order_id, failReason, liveStatus);
          tx.status = 'failed';
          tx.error_message = failReason;

          // Dispatch Webhook to Agent
          try {
            let targetWebhook = tx.request_payload?.webhook_url || tx.request_payload?.callback_url;
            if (!targetWebhook) {
              const { data: cred } = await supabaseAdmin
                .from('b2b_api_credentials')
                .select('webhook_url')
                .eq('id', tx.agent_id)
                .single();
              targetWebhook = cred?.webhook_url;
            }
            firePayoutWebhook(targetWebhook, tx.agent_id, {
              event: 'PAYOUT_STATUS_UPDATE',
              order_id: tx.order_id,
              client_order_id: tx.client_order_id || null,
              utr: null,
              status: 'failed',
              amount: Number(tx.amount),
              base_fee: Number(tx.request_payload?.base_fee || tx.base_charge || Math.round((Number(tx.charge ?? tx.fee ?? 0) / 1.18) * 100) / 100),
              gst: Number(tx.request_payload?.gst_amount || tx.gst_amount || Math.round((Number(tx.charge ?? tx.fee ?? 0) - (Number(tx.charge ?? tx.fee ?? 0) / 1.18)) * 100) / 100),
              fee: Number(tx.charge ?? tx.fee ?? 0),
              refunded_to_payout_wallet: true,
              failure_reason: failReason,
              beneficiary_name: tx.beneficiary_name,
              account_number: tx.account_number,
              ifsc_code: tx.ifsc_code,
              timestamp: new Date().toISOString()
            });
          } catch (hookErr) {
            console.warn('[B2B checkPayoutStatusAdmin] Webhook dispatch warning:', hookErr);
          }
        }
      } catch (checkErr) {
        console.warn('[B2B checkPayoutStatusAdmin] Upstream status check failed:', checkErr);
      }
    }

    return res.json({
      status: 'success',
      data: {
        id: tx.id,
        order_id: tx.order_id,
        client_order_id: tx.client_order_id || null,
        utr: tx.utr || null,
        beneficiary_name: tx.beneficiary_name,
        account_number: tx.account_number,
        ifsc_code: tx.ifsc_code,
        bank_name: tx.bank_name,
        transfer_mode: tx.transfer_mode,
        amount: Number(tx.amount),
        base_fee: Number(tx.request_payload?.base_fee || tx.base_charge || Math.round((Number(tx.charge ?? tx.fee ?? 0) / 1.18) * 100) / 100),
        gst: Number(tx.request_payload?.gst_amount || tx.gst_amount || Math.round((Number(tx.charge ?? tx.fee ?? 0) - (Number(tx.charge ?? tx.fee ?? 0) / 1.18)) * 100) / 100),
        fee: Number(tx.charge ?? tx.fee ?? 0),
        total_deducted: Number(tx.total_deducted),
        status: tx.status,
        failure_reason: tx.error_message || tx.failure_reason || null,
        created_at: tx.created_at,
        updated_at: tx.updated_at
      }
    });
  } catch (err: any) {
    console.error('[B2B checkPayoutStatusAdmin Error]', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to check payout status' });
  }
};

/**
 * Admin action to resend webhook notification for a payout transaction
 */
export const resendPayoutWebhookAdmin = async (req: Request, res: Response) => {
  try {
    const { order_id, webhook_url_override } = req.body;
    if (!order_id) {
      return res.status(400).json({ status: 'error', message: 'order_id is required' });
    }

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('b2b_payout_transactions')
      .select('*, b2b_api_credentials(id, b2b_login_id, webhook_url)')
      .eq('order_id', order_id)
      .maybeSingle();

    if (txErr || !tx) {
      return res.status(404).json({ status: 'error', message: 'Payout transaction not found' });
    }

    const agentCreds = (tx as any).b2b_api_credentials;
    const targetWebhookUrl = String(webhook_url_override || agentCreds?.webhook_url || '').trim();

    if (!targetWebhookUrl || !targetWebhookUrl.startsWith('http')) {
      return res.status(400).json({
        status: 'error',
        message: `No Webhook URL configured for agent "${agentCreds?.b2b_login_id || 'Agent'}". Please configure their Webhook URL in B2B Agents settings first.`
      });
    }

    const payload = {
      event: 'PAYOUT_STATUS_UPDATE',
      order_id: tx.order_id,
      client_order_id: tx.client_order_id || null,
      utr: tx.utr || null,
      status: tx.status,
      amount: Number(tx.amount),
      base_fee: Number(tx.base_fee || tx.base_charge || 0),
      gst: Number(tx.gst_amount || 0),
      fee: Number(tx.fee || tx.charge || 0),
      total_deducted: Number(tx.total_deducted || (Number(tx.amount) + Number(tx.fee || 0))),
      beneficiary_name: tx.beneficiary_name,
      account_number: tx.account_number,
      ifsc_code: tx.ifsc_code,
      timestamp: new Date().toISOString()
    };

    console.log(`[Admin Resend Webhook] Dispatching to ${targetWebhookUrl} for order ${order_id}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const webhookRes = await fetch(targetWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const resText = await webhookRes.text();

    await supabaseAdmin.from('b2b_webhook_logs').insert({
      agent_id: tx.agent_id,
      transaction_id: tx.order_id,
      webhook_url: targetWebhookUrl,
      payload,
      response_status: webhookRes.status,
      response_body: resText.substring(0, 1000)
    });

    if (webhookRes.ok) {
      return res.json({
        status: 'success',
        message: `Webhook delivered successfully to ${targetWebhookUrl} (HTTP ${webhookRes.status})`,
        response_status: webhookRes.status,
        response_body: resText.substring(0, 500)
      });
    } else {
      return res.json({
        status: 'warning',
        message: `Webhook sent to ${targetWebhookUrl}, but partner server returned HTTP ${webhookRes.status}`,
        response_status: webhookRes.status,
        response_body: resText.substring(0, 500)
      });
    }
  } catch (err: any) {
    console.error('[resendPayoutWebhookAdmin Error]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to send webhook: ' + (err.message || 'Unknown network error') });
  }
};

/**
 * Admin action to test an agent's webhook URL with a test ping
 */
export const testAgentWebhookAdmin = async (req: Request, res: Response) => {
  try {
    const { webhook_url, agent_id } = req.body;
    const cleanUrl = String(webhook_url || '').trim();
    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      return res.status(400).json({ status: 'error', message: 'Valid HTTP/HTTPS Webhook URL is required' });
    }

    const testPayload = {
      event: 'WEBHOOK_TEST_PING',
      message: 'This is a test notification from UsePay B2B Gateway.',
      agent_id: agent_id || null,
      timestamp: new Date().toISOString()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const webhookRes = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const resText = await webhookRes.text();

    return res.json({
      status: webhookRes.ok ? 'success' : 'warning',
      message: `Partner server responded with HTTP ${webhookRes.status}`,
      response_status: webhookRes.status,
      response_body: resText.substring(0, 500)
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: 'Connection failed: ' + (err.message || 'Server unreachable') });
  }
};

/**
 * ==========================================
 * CSPL B2B FAST BILL PAYMENT API CONTROLLER
 * ==========================================
 */

/**
 * 1. Get CSPL Biller Info
 */
export const getCsplBillerInfo = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId;
    const { billerId } = req.body;

    if (!billerId) {
      return res.status(400).json({ status: 'error', message: 'billerId is required' });
    }

    // Verify agent has CSPL permission
    const { data: agent } = await supabaseAdmin
      .from('b2b_api_credentials')
      .select('is_cspl_enabled')
      .eq('id', agentId)
      .single();

    if (!agent || !agent.is_cspl_enabled) {
      return res.status(403).json({
        status: 'error',
        message: 'CSPL Fast Bill Payment API is not enabled for your account. Please contact administrator.'
      });
    }

    const data = await camlenioBbps.getBillerInfo(String(billerId).trim());

    await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/b2b/cspl/biller-info',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: req.body,
        status_code: 200,
        response_payload: data
      });

    res.json({
      status: 'success',
      data
    });
  } catch (err: any) {
    console.error('[B2B getCsplBillerInfo Error]', err);
    res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch biller info' });
  }
};

/**
 * 2. Fetch CSPL Bill
 */
export const fetchCsplBill = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId;
    const { billerId, customerParams, customerMobile, customerEmail } = req.body;

    if (!billerId || !customerParams) {
      return res.status(400).json({ status: 'error', message: 'billerId and customerParams are required' });
    }

    // Verify agent has CSPL permission
    const { data: agent } = await supabaseAdmin
      .from('b2b_api_credentials')
      .select('is_cspl_enabled')
      .eq('id', agentId)
      .single();

    if (!agent || !agent.is_cspl_enabled) {
      return res.status(403).json({
        status: 'error',
        message: 'CSPL Fast Bill Payment API is not enabled for your account. Please contact administrator.'
      });
    }

    let inputParams: any[] = [];
    if (Array.isArray(customerParams)) {
      inputParams = customerParams.map((p: any) => ({
        paramName: String(p.paramName || p.name || ''),
        paramValue: String(p.paramValue || p.value || '')
      })).filter(p => p.paramName);
    } else if (typeof customerParams === 'object' && customerParams !== null) {
      inputParams = Object.keys(customerParams).map((key) => ({
        paramName: key,
        paramValue: String(customerParams[key] || '')
      }));
    }

    const payload = {
      billerId: String(billerId).trim(),
      customerMobile: (customerMobile || "9999999999").replace(/[^0-9]/g, '').slice(-10) || "9999999999",
      customerEmail: customerEmail || "",
      inputParams
    };

    const data = await camlenioBbps.fetchBill(payload);

    await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/b2b/cspl/fetch-bill',
        request_ip: (req as any).clientIp || req.ip,
        request_payload: req.body,
        status_code: 200,
        response_payload: data
      });

    res.json({
      status: data.responseCode === '000' || data.status === 'SUCCESS' ? 'success' : 'error',
      message: data.responseCode === '000' || data.status === 'SUCCESS' ? 'Bill fetched successfully' : (data.message || data.responseReason || 'Failed to fetch bill'),
      data
    });
  } catch (err: any) {
    console.error('[B2B fetchCsplBill Error]', err);
    res.status(500).json({ status: 'error', message: err.message || 'Failed to fetch bill' });
  }
};

/**
 * 3. Pay CSPL Bill (Atomic CSPL Wallet Balance deduction + Auto-refund)
 */
export const payCsplBill = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agentId;
    const {
      billerId,
      billerName,
      amount,
      customerParams,
      customerMobile,
      customerName,
      billDetails,
      client_transaction_id
    } = req.body;

    if (!billerId || !amount || !customerParams) {
      return res.status(400).json({ status: 'error', message: 'billerId, amount, and customerParams are required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid bill payment amount' });
    }

    // 1. Verify agent permission and fetch CSPL balance
    const { data: agentData } = await supabaseAdmin
      .from('b2b_api_credentials')
      .select('id, is_cspl_enabled, cspl_wallet_balance, charge_per_bill, developer_charge, owner_charge, custom_max_bill_payment_limit, webhook_url')
      .eq('id', agentId)
      .single();

    if (!agentData || !agentData.is_cspl_enabled) {
      return res.status(403).json({
        status: 'error',
        message: 'CSPL Fast Bill Payment API is not enabled for your account. Please contact administrator.'
      });
    }

    // 2. Limit Check
    const { data: globalSettings } = await supabaseAdmin
      .from('qr_settings')
      .select('cspl_max_limit, bbps_max_limit')
      .eq('id', 1)
      .maybeSingle();

    const maxLimit = Number(globalSettings?.cspl_max_limit) > 0
      ? Number(globalSettings?.cspl_max_limit)
      : (Number(globalSettings?.bbps_max_limit) || 49999);

    if (parsedAmount > maxLimit) {
      return res.status(400).json({
        status: 'error',
        message: `Transaction amount ₹${parsedAmount.toLocaleString('en-IN')} exceeds CSPL maximum single limit of ₹${maxLimit.toLocaleString('en-IN')}.`
      });
    }

    // 3. Calculate Charges
    let baseChargePerBill = parseFloat(agentData.charge_per_bill?.toString() || '0');
    let baseDeveloperCharge = parseFloat(agentData.developer_charge?.toString() || '0');
    let baseOwnerCharge = parseFloat(agentData.owner_charge?.toString() || '0');

    if (baseDeveloperCharge === 0 && baseOwnerCharge === 0 && baseChargePerBill > 0) {
      baseOwnerCharge = baseChargePerBill;
    }

    // 50k Slab Multiplier
    const multiplier = Math.floor(parsedAmount / 50000) + 1;
    const developerCharge = baseDeveloperCharge * multiplier;
    const ownerCharge = baseOwnerCharge * multiplier;
    const chargePerBill = developerCharge + ownerCharge;
    const totalDeduction = parsedAmount + chargePerBill;

    // 4. Check & Deduct CSPL Wallet Balance
    const currentCsplBal = parseFloat(agentData.cspl_wallet_balance?.toString() || '0');
    if (currentCsplBal < totalDeduction) {
      return res.status(400).json({
        status: 'error',
        message: `Insufficient CSPL wallet balance. Required: ₹${totalDeduction.toFixed(2)} (Bill: ₹${parsedAmount.toFixed(2)}, Charge: ₹${chargePerBill.toFixed(2)}), Available: ₹${currentCsplBal.toFixed(2)}`
      });
    }

    // Atomic deduction via RPC with fallback
    let deducted = false;
    const { data: rpcDeduct, error: rpcErr } = await supabaseAdmin.rpc('deduct_b2b_cspl_wallet_balance', {
      p_agent_id: agentId,
      p_amount: totalDeduction
    });

    if (!rpcErr && rpcDeduct === true) {
      deducted = true;
    } else {
      // Direct atomic fallback
      const { data: updatedCred, error: updateErr } = await supabaseAdmin
        .from('b2b_api_credentials')
        .update({ cspl_wallet_balance: currentCsplBal - totalDeduction })
        .eq('id', agentId)
        .gte('cspl_wallet_balance', totalDeduction)
        .select('cspl_wallet_balance')
        .maybeSingle();

      if (!updateErr && updatedCred) {
        deducted = true;
      }
    }

    if (!deducted) {
      return res.status(400).json({
        status: 'error',
        message: 'Failed to deduct from CSPL wallet or insufficient balance.'
      });
    }

    // 5. Generate Transaction ID
    const csplTxnId = `CSPL_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const finalClientTxnId = (client_transaction_id || csplTxnId).trim();

    // 6. Build CSPL Payload
    const rawData = billDetails?.rawFetchData?.data || billDetails?.rawFetchData || {};
    const fetchedBillerResponse = billDetails?.billerResponse || rawData?.billerResponse;
    const fetchRequestId = billDetails?.fetchRequestId || billDetails?.billerResponse?.requestId || rawData?.requestId || billDetails?.rawFetchData?.refid || rawData?.refid;
    const csplRequestId = fetchRequestId || ("CSPL" + Date.now().toString() + Math.floor(Math.random() * 1000).toString());

    let paramArray: any[] = [];
    if (Array.isArray(customerParams)) {
      paramArray = customerParams.map((p: any) => ({
        paramName: String(p.paramName || p.name || '').trim(),
        paramValue: String(p.paramValue || p.value || '').trim()
      })).filter(p => p.paramName);
    } else if (typeof customerParams === 'object' && customerParams !== null) {
      paramArray = Object.entries(customerParams).map(([name, value]) => ({
        paramName: String(name).trim(),
        paramValue: String(value).trim()
      }));
    }

    const rawCat = billDetails?.catname || billDetails?.categoryName || (billerName && billerName.toLowerCase().includes("card") ? "Credit Card" : billerName) || "Credit Card";
    const cleanCatName = String(rawCat).replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Credit Card";

    const custBillAmountInPaise = Math.round(parsedAmount * 100);
    const fetchedAmountInPaise = billDetails?.billAmount
      ? Math.round(Number(billDetails.billAmount) * 100)
      : (fetchedBillerResponse?.billAmount ? Number(fetchedBillerResponse.billAmount) : custBillAmountInPaise);

    const csplPayload: any = {
      requestId: csplRequestId,
      customerMobile: (customerMobile || "9999999999").replace(/[^0-9]/g, '').slice(-10) || "9999999999",
      customerName: customerName || billDetails?.customerName || fetchedBillerResponse?.customerName || "BBPS Customer",
      catname: cleanCatName,
      billerId: String(billerId).trim(),
      billamount: fetchedAmountInPaise || custBillAmountInPaise,
      cust_billamount: custBillAmountInPaise,
      inputParams: paramArray
    };

    if (fetchedBillerResponse) {
      csplPayload.billerResponse = fetchedBillerResponse;
    }

    // Insert pending log in b2b_api_logs
    const { data: logRecord } = await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/b2b/cspl/pay-bill',
        request_ip: (req as any).clientIp || req.ip,
        developer_charge: developerCharge,
        owner_charge: ownerCharge,
        request_payload: {
          ...req.body,
          transaction_id: csplTxnId,
          client_transaction_id: finalClientTxnId,
          totalDeduction,
          chargeDeducted: chargePerBill,
          csplPayload
        },
        response_payload: {
          payment_status: 'pending',
          transaction_id: csplTxnId,
          client_transaction_id: finalClientTxnId
        },
        status_code: 202
      })
      .select('id')
      .single();

    // 7. Call CSPL API
    let csplResponse: any = null;
    let paymentSuccess = false;

    try {
      csplResponse = await camlenioBbps.payBill(csplPayload);
      if (
        csplResponse?.responseCode === '000' ||
        csplResponse?.data?.responseCode === '000' ||
        csplResponse?.status === 'SUCCESS' ||
        csplResponse?.status === 'SUCCESSFUL'
      ) {
        paymentSuccess = true;
      }
    } catch (apiErr: any) {
      console.error('[CSPL PayBill API Call Error]', apiErr);
      csplResponse = { status: 'ERROR', message: apiErr.message || 'CSPL Gateway Timeout / Error' };
    }

    // 8. Handle Success or Auto-Refund
    if (paymentSuccess) {
      // Update log to success
      if (logRecord?.id) {
        await supabaseAdmin
          .from('b2b_api_logs')
          .update({
            status_code: 200,
            payment_status: 'success',
            response_payload: {
              ...csplResponse,
              payment_status: 'success',
              transaction_id: csplTxnId,
              client_transaction_id: finalClientTxnId
            }
          })
          .eq('id', logRecord.id);
      }

      // Credit admin balance if owner charge exists
      if (ownerCharge > 0) {
        try {
          await supabaseAdmin.rpc('add_admin_balance', { p_amount: ownerCharge });
        } catch (_) {}
      }

      // Webhook notification if configured
      if (agentData.webhook_url) {
        try {
          fetch(agentData.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'CSPL_BILL_PAYMENT_SUCCESS',
              transaction_id: csplTxnId,
              client_transaction_id: finalClientTxnId,
              amount: parsedAmount,
              status: 'success',
              response: csplResponse,
              timestamp: new Date().toISOString()
            })
          }).catch(e => console.warn('[CSPL Webhook Error]', e));
        } catch (_) {}
      }

      return res.json({
        status: 'success',
        message: 'Bill paid successfully via CSPL Fast BBPS',
        data: {
          transaction_id: csplTxnId,
          client_transaction_id: finalClientTxnId,
          amount: parsedAmount,
          charge_deducted: chargePerBill,
          total_deducted: totalDeduction,
          cspl_reference: csplResponse?.refid || csplResponse?.rrn || csplResponse?.data?.rrn || csplTxnId,
          status: 'success',
          gateway_response: csplResponse
        }
      });
    } else {
      // PAYMENT FAILED: AUTO-REFUND to CSPL Wallet immediately!
      console.warn(`[CSPL PayBill - FAILED] Auto-refunding ₹${totalDeduction} to agent ${agentId} CSPL Wallet...`);
      let refunded = false;

      const { data: rpcRefund } = await supabaseAdmin.rpc('refund_b2b_cspl_wallet_balance', {
        p_agent_id: agentId,
        p_amount: totalDeduction
      });

      if (rpcRefund === true) {
        refunded = true;
      } else {
        // Fallback refund update
        try {
          await supabaseAdmin.rpc('add_b2b_cspl_wallet_balance', { p_agent_id: agentId, p_amount: totalDeduction });
        } catch {
          const { data: cData } = await supabaseAdmin.from('b2b_api_credentials').select('cspl_wallet_balance').eq('id', agentId).single();
          if (cData) {
            await supabaseAdmin.from('b2b_api_credentials').update({ cspl_wallet_balance: (parseFloat(cData.cspl_wallet_balance || '0') + totalDeduction) }).eq('id', agentId);
          }
        }
        refunded = true;
      }

      // Update log to failed
      if (logRecord?.id) {
        await supabaseAdmin
          .from('b2b_api_logs')
          .update({
            status_code: 400,
            payment_status: 'failed',
            charge_deducted: 0,
            response_payload: {
              ...csplResponse,
              payment_status: 'failed',
              auto_refunded: refunded,
              transaction_id: csplTxnId,
              client_transaction_id: finalClientTxnId
            }
          })
          .eq('id', logRecord.id);
      }

      return res.status(400).json({
        status: 'error',
        message: csplResponse?.message || csplResponse?.error || 'Bill payment failed at CSPL gateway. Your CSPL wallet balance has been refunded.',
        data: {
          transaction_id: csplTxnId,
          client_transaction_id: finalClientTxnId,
          status: 'failed',
          refunded: true,
          gateway_response: csplResponse
        }
      });
    }
  } catch (err: any) {
    console.error('[B2B payCsplBill Error]', err);
    res.status(500).json({ status: 'error', message: err.message || 'Internal server error while processing CSPL bill payment' });
  }
};

/**
 * 4. Check CSPL Bill Payment Status
 */
export const checkCsplStatus = async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;
    const agentId = (req as any).agentId;

    if (!transaction_id) {
      return res.status(400).json({ status: 'error', message: 'transaction_id is required' });
    }

    // Look up transaction in b2b_api_logs
    const { data: log, error } = await supabaseAdmin
      .from('b2b_api_logs')
      .select('*')
      .eq('agent_id', agentId)
      .or(`id.eq.${transaction_id},request_payload->>transaction_id.eq.${transaction_id},request_payload->>client_transaction_id.eq.${transaction_id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !log) {
      return res.status(404).json({ status: 'error', message: `Transaction ${transaction_id} not found` });
    }

    res.json({
      status: 'success',
      data: {
        transaction_id: log.request_payload?.transaction_id || log.id,
        client_transaction_id: log.request_payload?.client_transaction_id,
        status: log.payment_status || (log.status_code === 200 ? 'success' : 'failed'),
        endpoint: log.endpoint,
        amount: log.request_payload?.amount,
        charge_deducted: log.request_payload?.chargeDeducted,
        total_deduction: log.request_payload?.totalDeduction,
        response_payload: log.response_payload,
        created_at: log.created_at
      }
    });
  } catch (err: any) {
    console.error('[B2B checkCsplStatus Error]', err);
    res.status(500).json({ status: 'error', message: err.message || 'Failed to check status' });
  }
};


