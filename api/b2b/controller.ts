import { Request, Response } from 'express';
import { supabaseAdmin } from '../../server';
import * as billAvenue from '../../services/billavenue';

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
      .select('wallet_balance')
      .eq('id', agentId)
      .single();

    if (error) throw error;
    res.json({ status: 'success', data: { balance: data.wallet_balance } });
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
    const { data: log, error: logError } = await supabaseAdmin
      .from('b2b_api_logs')
      .select('*')
      .eq('endpoint', '/api/b2b/pay-bill')
      .contains('request_payload', { transaction_id })
      .single();

    if (logError || !log) {
      return res.status(404).json({ status: 'error', message: 'Transaction not found in logs' });
    }

    const bpr = log.response_payload?.billPayResponse || log.response_payload?.ExtBillPayResponse || log.response_payload;
    const cc01RefId = bpr?.txnRefId || bpr?.billerResponse?.txnRefId || log.request_payload?.billerResponseInfo?.txnRefId;
    
    // If CC01 ID is missing, check if this transaction was rejected by gateway or has errorInfo
    if (!cc01RefId || !String(cc01RefId).startsWith('CC01')) {
      const errorMsg = bpr?.errorInfo?.error?.errorMessage 
        || log.response_payload?.reason 
        || log.response_payload?.error 
        || 'Bill payment failed at BillAvenue gateway (No CC01 Ref generated).';

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
        message: `BillAvenue CC01 Transaction Reference ID not found for transaction ${transaction_id}. ${errorMsg}`
      });
    }

    const statusResult = await billAvenue.getTransactionStatus(String(cc01RefId), 'TRANS_REF_ID');
    let bbpsStatus = 'UNKNOWN';
    
    if (statusResult?.json) {
       const root = statusResult.json.transactionStatusResp || statusResult.json.transactionStatusRes || statusResult.json.transactionStatusResponse;
       if (root) {
         if (root.responseCode !== '000') {
           console.warn(`[B2B Admin CheckStatus] Non-000 response code (${root.responseCode}) received for ${transaction_id}`);
           bbpsStatus = 'PENDING';
         } else {
           const txnList = Array.isArray(root.txnList) ? root.txnList[0] : root.txnList;
           bbpsStatus = txnList?.txnStatus?.toUpperCase() || 'UNKNOWN';
         }
       }
    }
    
    let localStatus = log.payment_status || 'pending';
    
    // If BBPS Status is terminal but our local status is still pending, update it!
    if (localStatus === 'pending' && (bbpsStatus === 'SUCCESS' || bbpsStatus === 'FAILED' || bbpsStatus === 'FAILURE')) {
      let newStatus = bbpsStatus === 'SUCCESS' ? 'success' : 'failed';
      let newStatusCode = newStatus === 'success' ? 200 : 500;
      let chargeDeducted = log.request_payload?.chargeDeducted || 0;
      let updatedPayload = log.response_payload || {};
      updatedPayload = { ...updatedPayload, finalStatus: newStatus, payment_status: newStatus };

      await supabaseAdmin
        .from('b2b_api_logs')
        .update({ 
          payment_status: newStatus,
          status_code: newStatusCode,
          charge_deducted: newStatus === 'success' ? chargeDeducted : 0,
          response_payload: updatedPayload
        })
        .eq('id', log.id);

      if (newStatus === 'failed') {
        const refundAmount = log.request_payload?.totalDeduction || 0;
        if (refundAmount > 0) {
          await supabaseAdmin.rpc('add_b2b_wallet_balance', { p_agent_id: log.agent_id, p_amount: refundAmount });
        }
      } else if (newStatus === 'success') {
        if (chargeDeducted > 0) {
          await supabaseAdmin.rpc('add_admin_balance', { p_amount: chargeDeducted });
        }
      }
      
      localStatus = newStatus;
    }

    return res.json({
      status: 'success',
      data: {
        transaction_id,
        current_status: localStatus,
        bbps_status: bbpsStatus,
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
        reqPayload?.transaction_id === targetTxnId ||
        reqPayload?.client_transaction_id === targetTxnId ||
        cc01Id === targetTxnId
      );
    });

    if (!log) {
      return res.status(404).json({ status: 'error', message: `Transaction ${targetTxnId} not found for this agent` });
    }

    const bpr = log.response_payload?.billPayResponse || log.response_payload?.ExtBillPayResponse || log.response_payload;
    const cc01RefId = bpr?.txnRefId || bpr?.billerResponse?.txnRefId || log.request_payload?.billerResponseInfo?.txnRefId;

    let localStatus = log.payment_status || 'pending';

    // 2. SCENARIO A: CC01 Ref ID is MISSING and local status is PENDING
    // This means the bill never reached BillAvenue/BBPS gateway! Mark as FAILED and AUTO-REFUND.
    if ((!cc01RefId || !String(cc01RefId).startsWith('CC01')) && localStatus === 'pending') {
      const refundAmount = log.request_payload?.totalDeduction || log.request_payload?.amount || 0;
      
      let updatedPayload = log.response_payload || {};
      updatedPayload = { 
        ...updatedPayload, 
        finalStatus: 'failed', 
        payment_status: 'failed',
        reason: 'Bill payment failed to reach BillAvenue gateway (No CC01 Ref generated).'
      };

      // Mark log as failed
      await supabaseAdmin
        .from('b2b_api_logs')
        .update({ 
          payment_status: 'failed',
          status_code: 500,
          charge_deducted: 0,
          response_payload: updatedPayload
        })
        .eq('id', log.id);

      // Perform Auto-Refund to Agent Wallet
      if (refundAmount > 0) {
        await supabaseAdmin.rpc('add_b2b_wallet_balance', {
          p_agent_id: log.agent_id,
          p_amount: refundAmount
        });
      }

      return res.json({
        status: 'success',
        data: {
          transaction_id: targetTxnId,
          client_transaction_id: log.request_payload?.client_transaction_id || targetTxnId,
          bbps_txn_ref_id: 'N/A',
          current_status: 'failed',
          bbps_status: 'FAILED_GATEWAY_ERROR',
          message: 'Bill payment failed to connect to biller gateway (No CC01 Ref generated). Agent wallet has been automatically refunded.',
          refund_status: 'REFUNDED',
          refunded_amount: refundAmount,
          polled_at: new Date().toISOString()
        }
      });
    }

    // If CC01 Ref ID is missing but status is already terminal (failed/success)
    if (!cc01RefId || !String(cc01RefId).startsWith('CC01')) {
      return res.json({
        status: 'success',
        data: {
          transaction_id: targetTxnId,
          client_transaction_id: log.request_payload?.client_transaction_id || targetTxnId,
          bbps_txn_ref_id: 'N/A',
          current_status: localStatus,
          bbps_status: localStatus.toUpperCase(),
          polled_at: new Date().toISOString()
        }
      });
    }

    // 3. SCENARIO B: CC01 Ref ID exists -> Query BillAvenue Live Status
    const statusResult = await billAvenue.getTransactionStatus(String(cc01RefId), 'TRANS_REF_ID');
    let bbpsStatus = 'UNKNOWN';
    
    if (statusResult?.json) {
       const root = statusResult.json.transactionStatusResp || statusResult.json.transactionStatusRes || statusResult.json.transactionStatusResponse;
       if (root) {
         if (root.responseCode !== '000') {
           console.warn(`[B2B CheckStatus] Non-000 response code (${root.responseCode}) received for ${targetTxnId}`);
           bbpsStatus = 'PENDING';
         } else {
           const txnList = Array.isArray(root.txnList) ? root.txnList[0] : root.txnList;
           bbpsStatus = txnList?.txnStatus?.toUpperCase() || 'UNKNOWN';
         }
       }
    }

    // If BBPS Status is terminal but local status is pending, update DB & Refund/Profit
    if (localStatus === 'pending' && (bbpsStatus === 'SUCCESS' || bbpsStatus === 'FAILED' || bbpsStatus === 'FAILURE')) {
      let newStatus = bbpsStatus === 'SUCCESS' ? 'success' : 'failed';
      let newStatusCode = newStatus === 'success' ? 200 : 500;
      let chargeDeducted = log.request_payload?.chargeDeducted || 0;
      let updatedPayload = log.response_payload || {};
      updatedPayload = { ...updatedPayload, finalStatus: newStatus, payment_status: newStatus };

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
        }
      } else if (newStatus === 'success') {
        if (chargeDeducted > 0) {
          await supabaseAdmin.rpc('add_admin_balance', { p_amount: chargeDeducted });
        }
      }
      
      localStatus = newStatus;
    }

    return res.json({
      status: 'success',
      data: {
        transaction_id: targetTxnId,
        client_transaction_id: log.request_payload?.client_transaction_id || targetTxnId,
        bbps_txn_ref_id: String(cc01RefId),
        current_status: localStatus,
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

    const { billerId, amount, customerParams, mobile, billerResponseInfo, fetchRequestId, additionalInfo, paymentMode } = req.body;
    const agentId = (req as any).agentId;
    const billavenueAgentId = (req as any).billavenueAgentId;

    console.log(`\n[B2B PayBill - START] Agent: ${agentId}, Biller: ${billerId}, Amount: ${amount}`);
    console.log(`[B2B PayBill] Request Body:`, JSON.stringify(req.body));

    if (!billerId || !amount || !customerParams || !mobile) {
      console.error(`[B2B PayBill - ERROR] Missing parameters`);
      return res.status(400).json({ status: 'error', message: 'Missing required parameters for payment' });
    }

    // Fetch agent's charge_per_bill
    const { data: agentData } = await supabaseAdmin
      .from('b2b_api_credentials')
      .select('charge_per_bill, webhook_url')
      .eq('id', agentId)
      .single();

    let chargePerBill = 0;
    if (agentData?.charge_per_bill !== null && agentData?.charge_per_bill !== undefined) {
      chargePerBill = parseFloat(agentData.charge_per_bill);
    } else {
      // Fetch global setting
      const { data: globalSettings, error: globalErr } = await supabaseAdmin
        .from('b2b_settings')
        .select('global_charge_per_bill')
        .limit(1)
        .maybeSingle();
      
      if (!globalErr && globalSettings) {
        chargePerBill = parseFloat(globalSettings.global_charge_per_bill || '0');
      }
    }

    const parsedAmount = parseFloat(amount);
    const totalDeduction = parsedAmount + chargePerBill;

    console.log(`[B2B PayBill - WALLET CHECK] Attempting to deduct ₹${totalDeduction} from agent ${agentId} wallet (Bill: ${parsedAmount} + Charge: ${chargePerBill})...`);

    // 1. Deduct total amount securely from b2b wallet via Atomic RPC
    const { data: deductSuccess, error: walletDeductError } = await supabaseAdmin.rpc('deduct_b2b_wallet_balance', {
      p_agent_id: agentId,
      p_amount: totalDeduction
    });

    if (walletDeductError || !deductSuccess) {
      console.error(`[B2B PayBill - WALLET ERROR] Failed to deduct ₹${totalDeduction} from agent ${agentId}. Error:`, walletDeductError);
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient balance or transaction failed'
      });
    }

    console.log(`[B2B PayBill - WALLET SUCCESS] Successfully deducted ₹${totalDeduction} from agent ${agentId}.`);

    // 1. Generate Custom Transaction ID for tracing
    // If the client provides their own transaction ID, we use it. Otherwise, we generate one starting with BBPSU.
    const customTxnId = req.body.client_transaction_id || `BBPSU${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    // Log the transaction attempt in b2b_api_logs
    const { data: logData, error: logError } = await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/b2b/pay-bill',
        request_payload: { ...req.body, transaction_id: customTxnId, totalDeduction, chargeDeducted: chargePerBill },
        response_payload: { payment_status: 'pending', transaction_id: customTxnId },
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
      console.log(`[B2B PayBill - BILLAVENUE REQ] Calling billavenue.payBill with amount ${parsedAmount}, initChannel AGT...`);
      apiResponse = await billAvenue.payBill(
        billerId,
        formattedParams,
        mobile,
        parsedAmount,
        paymentMode || 'Cash', // paymentMode (Agent typically uses Cash/Wallet, or custom mode like UPI/Debit Card)
        'N', // quickPay
        undefined, // ccf1
        { rawBillerResponse: rawBillerResp, additionalInfo: formattedAdditionalInfo }, // billDetails
        undefined, // remitterName
        'AGT', // initChannel
        fetchRequestId, // fetchRequestId
        billavenueAgentId
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
          response_payload: { error: payErr.message, transaction_id: customTxnId }
        }).eq('id', logId);
      }
      return res.status(500).json({ status: 'error', message: payErr.message || 'Payment failed at gateway' });
    }

    // 3. Process the response
    const payJson = apiResponse.json;
    const bpr = payJson?.billPayResponse || payJson?.ExtBillPayResponse || payJson;
    const responseCode = bpr?.responseCode || payJson?.responseCode;
    const txnStatus = (bpr?.txnStatus || payJson?.txnStatus || '').toUpperCase();
    const hasErrorInfo = !!(bpr?.errorInfo || payJson?.errorInfo || bpr?.reason || payJson?.reason);

    let finalStatus = 'pending';
    if (txnStatus === 'SUCCESS' || responseCode === '000') {
      finalStatus = 'success';
    } else if (txnStatus === 'FAILED' || (responseCode && responseCode !== '000') || hasErrorInfo) {
      finalStatus = 'failed';
      // Initiate refund (Refund total including charge)
      await supabaseAdmin.rpc('add_b2b_wallet_balance', { p_agent_id: agentId, p_amount: totalDeduction });
      console.log(`[B2B PayBill - REFUND] Refunded ₹${totalDeduction} to agent ${agentId} due to FAILED status from BillAvenue.`);
    }

    console.log(`[B2B PayBill - FINAL STATUS] ${finalStatus.toUpperCase()} for txn ${customTxnId}`);

    // Update log
    if (logId) {
      const updatePayload: any = {
        status_code: finalStatus === 'success' ? 200 : 500,
        payment_status: finalStatus,
        response_payload: { ...payJson, finalStatus, payment_status: finalStatus, transaction_id: customTxnId }
      };
      // Only log the charge as deducted if payment is successful
      if (finalStatus === 'success') {
        updatePayload.charge_deducted = chargePerBill;
        // Credit the API charge to the Admin's Profit Balance
        if (chargePerBill > 0) {
          await supabaseAdmin.rpc('add_admin_balance', { p_amount: chargePerBill });
          console.log(`[B2B PayBill - ADMIN PROFIT] Credited ₹${chargePerBill} to admin balance for successful bill.`);
        }
      }
      await supabaseAdmin.from('b2b_api_logs').update(updatePayload).eq('id', logId);
    }

    res.json({
      status: finalStatus === 'success' ? 'success' : 'error',
      message: finalStatus === 'success' ? 'Bill Paid successfully' : 'Payment failed',
      data: payJson,
      transaction_id: customTxnId,
      payment_status: finalStatus,
      charge_deducted: finalStatus === 'success' ? chargePerBill : 0
    });

    // Fire webhook asynchronously
    if (agentData?.webhook_url && agentData.webhook_url.startsWith('http')) {
      const webhookPayload = {
        event: 'PAYMENT_STATUS_UPDATE',
        transaction_id: customTxnId,
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
          transaction_id: customTxnId,
          webhook_url: agentData.webhook_url,
          payload: webhookPayload,
          response_status: webhookRes.status,
          response_body: responseBody
        });
      })
      .catch(async (webhookError) => {
        await supabaseAdmin.from('b2b_webhook_logs').insert({
          agent_id: agentId,
          transaction_id: customTxnId,
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
    const { amount, utr_number, transaction_ref_no, proof_url, admin_bank_account_id, bank_account_id } = req.body;

    const reqUtr = String(utr_number || transaction_ref_no || '').trim();
    const reqAmount = Number(amount);
    const bankId = String(admin_bank_account_id || bank_account_id || '').trim();

    if (!reqAmount || isNaN(reqAmount) || reqAmount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Valid amount is required' });
    }

    if (!reqUtr) {
      return res.status(400).json({ status: 'error', message: 'utr_number or transaction_ref_no is required' });
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
        status: 'pending'
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    // Log the API call in b2b_api_logs
    await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/v1/b2b/fund-request',
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
