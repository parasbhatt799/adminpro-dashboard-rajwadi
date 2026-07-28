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
        method: 'GET',
        request_body: req.query,
        status_code: 200,
        response_body: { message: `Fetched page ${pageNum} with ${data?.length} billers` }
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
    
    res.json({
      status: 'success',
      data: response.json // Returns the JSON converted from BillAvenue XML
    });

  } catch (err: any) {
    console.error('[B2B fetchBill Error]', err);
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

export const payBill = async (req: Request, res: Response) => {
  try {
    const { billerId, amount, customerParams, mobile, billerResponseInfo } = req.body;
    const agentId = (req as any).agentId;
    const billavenueAgentId = (req as any).billavenueAgentId;

    if (!billerId || !amount || !customerParams || !mobile) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters for payment' });
    }

    // Fetch agent's charge_per_bill
    const { data: agentData } = await supabaseAdmin
      .from('b2b_api_credentials')
      .select('charge_per_bill')
      .eq('id', agentId)
      .single();
      
    const chargePerBill = parseFloat(agentData?.charge_per_bill || '0');
    const parsedAmount = parseFloat(amount);
    const totalDeduction = parsedAmount + chargePerBill;

    // 1. Deduct total amount securely from b2b wallet via Atomic RPC
    const { data: deductSuccess, error: deductError } = await supabaseAdmin.rpc('deduct_b2b_wallet_balance', {
      p_agent_id: agentId,
      p_amount: totalDeduction
    });

    if (deductError || !deductSuccess) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Insufficient balance or transaction failed' 
      });
    }

    // Generate custom transaction ID
    const customTxnId = `USEPAY${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    // Log the transaction attempt in b2b_api_logs
    const { data: logData } = await supabaseAdmin
      .from('b2b_api_logs')
      .insert({
        agent_id: agentId,
        endpoint: '/api/b2b/pay-bill',
        method: 'POST',
        request_body: { ...req.body, transaction_id: customTxnId, totalDeduction, chargeDeducted: chargePerBill },
        status_code: 202
      })
      .select('id')
      .single();
      
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

    // 2. Call BillAvenue Pay API
    let apiResponse;
    try {
      apiResponse = await billAvenue.payBill(
        billerId,
        formattedParams,
        mobile,
        parsedAmount,
        'Cash', // paymentMode (Agent typically uses Cash/Wallet)
        'N', // quickPay
        undefined, // ccf1
        billerResponseInfo, // billDetails
        undefined, // remitterName
        'AGT', // initChannel
        undefined, // fetchRequestId
        billavenueAgentId
      );
    } catch (payErr: any) {
      console.error('[B2B payBill Error] Pay API failed', payErr);
      // Refund user if API failed completely (Refund total including charge)
      await supabaseAdmin.rpc('add_b2b_wallet_balance', { p_agent_id: agentId, p_amount: totalDeduction });
      
      if (logId) {
          await supabaseAdmin.from('b2b_api_logs').update({ 
            status_code: 500, 
            response_body: { error: payErr.message, transaction_id: customTxnId } 
          }).eq('id', logId);
      }
      return res.status(500).json({ status: 'error', message: payErr.message || 'Payment failed at gateway' });
    }

    // 3. Process the response
    const payJson = apiResponse.json;
    const bpr = payJson?.billPayResponse;
    
    // Log the BBPS status
    let finalStatus = 'pending';
    if (bpr?.txnStatus?.toUpperCase() === 'SUCCESS' || payJson?.responseCode === '000') {
       finalStatus = 'success';
    } else if (bpr?.txnStatus?.toUpperCase() === 'FAILED' || payJson?.responseCode === '999') {
       finalStatus = 'failed';
       // Initiate refund (Refund total including charge)
       await supabaseAdmin.rpc('add_b2b_wallet_balance', { p_agent_id: agentId, p_amount: totalDeduction });
    }

    // Update log
    if (logId) {
        const updatePayload: any = {
            status_code: 200, 
            response_body: { ...payJson, finalStatus, transaction_id: customTxnId }
        };
        // Only log the charge as deducted if payment is successful
        if (finalStatus === 'success') {
           updatePayload.charge_deducted = chargePerBill;
        }
        await supabaseAdmin.from('b2b_api_logs').update(updatePayload).eq('id', logId);
    }

    res.json({
      status: 'success',
      data: payJson,
      transaction_id: customTxnId,
      payment_status: finalStatus,
      charge_deducted: finalStatus === 'success' ? chargePerBill : 0
    });

  } catch (err: any) {
    console.error('[B2B payBill Exception]', err);
    res.status(500).json({ status: 'error', message: err.message || 'Internal Server Error' });
  }
};
