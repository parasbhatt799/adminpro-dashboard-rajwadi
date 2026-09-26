import { Router } from 'express';
import {
  getNixasoftConfig,
  saveNixasoftConfig,
  calculateSlabCharge,
  executeNixasoftPayout,
  checkNixasoftStatus,
  PayoutSlab
} from '../../services/nixasoft_payout.js';
import { supabaseAdmin } from '../../server.js';

const router = Router();

// 1. Get Public Config & User Access Info
router.get('/config', async (req, res) => {
  try {
    const config = getNixasoftConfig();
    const userId = req.query.userId as string | undefined;

    let isTester = false;
    if (userId) {
      try {
        const { data: user } = await supabaseAdmin
          .from('users_profiles')
          .select('is_tester')
          .eq('id', userId)
          .single();
        if (user) {
          isTester = Boolean(user.is_tester);
        }
      } catch (e) {
        console.warn('[Nixasoft Config] Could not check tester status for user:', userId);
      }
    }

    res.json({
      success: true,
      is_active: config.is_active,
      is_accessible: config.is_active || isTester,
      is_tester: isTester,
      min_payout: config.min_payout,
      max_payout: config.max_payout,
      notice: config.notice || '',
      slabs: (config.slabs || []).filter(s => s.is_active)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Calculate Slab Charge for User Input
router.post('/calculate-charge', (req, res) => {
  try {
    const { amount } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid transfer amount' });
    }

    const { charge, slab } = calculateSlabCharge(numAmount);
    const totalDeduction = numAmount + charge;

    res.json({
      success: true,
      amount: numAmount,
      charge,
      total_deduction: totalDeduction,
      slab
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Admin: Get Full Settings (Including API Tokens & All Slabs)
router.get('/admin/settings', async (req, res) => {
  try {
    const config = getNixasoftConfig();
    res.json({
      success: true,
      settings: config
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Admin: Update Master Settings & Toggle
router.post('/admin/settings', async (req, res) => {
  try {
    const { is_active, api_token, auth_token, min_payout, max_payout, notice } = req.body;

    const updated = saveNixasoftConfig({
      ...(is_active !== undefined ? { is_active: Boolean(is_active) } : {}),
      ...(api_token !== undefined ? { api_token: String(api_token).trim() } : {}),
      ...(auth_token !== undefined ? { auth_token: String(auth_token).trim() } : {}),
      ...(min_payout !== undefined ? { min_payout: Number(min_payout) } : {}),
      ...(max_payout !== undefined ? { max_payout: Number(max_payout) } : {}),
      ...(notice !== undefined ? { notice: String(notice).trim() } : {})
    });

    // Also sync payout_settings is_enabled in Supabase for realtime triggers
    try {
      if (is_active !== undefined) {
        await supabaseAdmin
          .from('payout_settings')
          .update({ is_enabled: Boolean(is_active) })
          .eq('id', 1);
      }
    } catch (dbErr: any) {
      console.warn('[Nixasoft Admin] Note: Could not sync to payout_settings DB:', dbErr.message);
    }

    res.json({
      success: true,
      message: 'Nixasoft payout settings saved successfully',
      settings: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Admin: Add Slab
router.post('/admin/slabs', (req, res) => {
  try {
    const { min_amount, max_amount, charge_type, charge_value, is_active } = req.body;

    if (min_amount === undefined || max_amount === undefined || charge_value === undefined) {
      return res.status(400).json({ success: false, message: 'All slab fields are required' });
    }

    const config = getNixasoftConfig();
    const newSlab: PayoutSlab = {
      id: `slab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      min_amount: Number(min_amount),
      max_amount: Number(max_amount),
      charge_type: charge_type === 'percentage' ? 'percentage' : 'flat',
      charge_value: Number(charge_value),
      is_active: is_active !== undefined ? Boolean(is_active) : true
    };

    const updatedSlabs = [...(config.slabs || []), newSlab].sort((a, b) => a.min_amount - b.min_amount);
    const updated = saveNixasoftConfig({ slabs: updatedSlabs });

    res.json({
      success: true,
      message: 'Payout slab added successfully',
      slabs: updated.slabs
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Admin: Update Slab
router.put('/admin/slabs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { min_amount, max_amount, charge_type, charge_value, is_active } = req.body;

    const config = getNixasoftConfig();
    const slabIndex = (config.slabs || []).findIndex(s => s.id === id);

    if (slabIndex === -1) {
      return res.status(404).json({ success: false, message: 'Slab not found' });
    }

    const currentSlab = config.slabs[slabIndex];
    config.slabs[slabIndex] = {
      ...currentSlab,
      ...(min_amount !== undefined ? { min_amount: Number(min_amount) } : {}),
      ...(max_amount !== undefined ? { max_amount: Number(max_amount) } : {}),
      ...(charge_type !== undefined ? { charge_type: charge_type === 'percentage' ? 'percentage' : 'flat' } : {}),
      ...(charge_value !== undefined ? { charge_value: Number(charge_value) } : {}),
      ...(is_active !== undefined ? { is_active: Boolean(is_active) } : {})
    };

    config.slabs.sort((a, b) => a.min_amount - b.min_amount);
    const updated = saveNixasoftConfig({ slabs: config.slabs });

    res.json({
      success: true,
      message: 'Payout slab updated successfully',
      slabs: updated.slabs
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Admin: Delete Slab
router.delete('/admin/slabs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const config = getNixasoftConfig();

    const filtered = (config.slabs || []).filter(s => s.id !== id);
    const updated = saveNixasoftConfig({ slabs: filtered });

    res.json({
      success: true,
      message: 'Payout slab deleted successfully',
      slabs: updated.slabs
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. User: Execute Payout with Dynamic Slab & Atomic Wallet Deduction
router.post('/send', async (req, res) => {
  try {
    const {
      userId,
      amount,
      bankName,
      holderName,
      accountNumber,
      ifscCode,
      transferMode = 'IMPS',
      mobileNumber,
      emailId,
      latitude = '23.0225',
      longitude = '72.5714',
      tpin
    } = req.body;

    if (!userId || !amount || !bankName || !holderName || !accountNumber || !ifscCode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payout parameters (user, bank, account, ifsc, amount).'
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount.' });
    }

    const config = getNixasoftConfig();

    // Fetch user profile for limits, tester status, wallet, and TPIN
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('users_profiles')
      .select('id, name, firm_name, wallet_balance, is_tester, status, mobile_number, email, tpin')
      .eq('id', userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    if (userProfile.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'Your account is currently inactive.' });
    }

    // Check service active flag vs tester bypass
    const isServiceActive = Boolean(config.is_active);
    const isTester = Boolean(userProfile.is_tester);

    if (!isServiceActive && !isTester) {
      return res.status(403).json({
        success: false,
        message: 'Payout service is temporarily disabled for maintenance. Please check back later.'
      });
    }

    // Min / Max Limits validation
    if (config.min_payout && numAmount < config.min_payout) {
      return res.status(400).json({
        success: false,
        message: `Minimum payout amount allowed is ₹${config.min_payout.toLocaleString()}.`
      });
    }

    if (config.max_payout && numAmount > config.max_payout) {
      return res.status(400).json({
        success: false,
        message: `Maximum payout amount allowed is ₹${config.max_payout.toLocaleString()}.`
      });
    }

    // TPIN verification if user set a TPIN
    if (userProfile.tpin) {
      if (!tpin) {
        return res.status(400).json({ success: false, message: 'TPIN is required to initiate payout.' });
      }
      if (String(userProfile.tpin).trim() !== String(tpin).trim()) {
        return res.status(400).json({ success: false, message: 'Incorrect TPIN entered.' });
      }
    }

    // Calculate Slab Charge server-side
    const { charge } = calculateSlabCharge(numAmount, config);
    const totalDeduction = numAmount + charge;

    // Check balance: Wallet Balance - Total Deduction must maintain at least 250
    const currentBalance = Number(userProfile.wallet_balance || 0);
    if (currentBalance - totalDeduction < 250) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance! Wallet must maintain minimum ₹250. Available: ₹${currentBalance.toFixed(2)}, Required: ₹${(totalDeduction + 250).toFixed(2)}`
      });
    }

    // Generate unique Request ID
    const clientRequestId = `NS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Atomic Wallet Deduction using database RPC
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('submit_auto_payout_request', {
      p_user_id: userId,
      p_bank_name: bankName.trim(),
      p_holder_name: holderName.trim(),
      p_account_number: accountNumber.trim(),
      p_ifsc_code: ifscCode.trim().toUpperCase(),
      p_amount: numAmount,
      p_charges: charge,
      p_txn_id: clientRequestId,
      p_status: 'pending'
    });

    if (rpcError || !rpcResult?.success) {
      console.error('[Nixasoft Send] Wallet deduction RPC failed:', rpcError || rpcResult);
      return res.status(400).json({
        success: false,
        message: rpcResult?.message || rpcError?.message || 'Failed to debit wallet balance.'
      });
    }

    const payoutId = rpcResult.payout_id;
    console.log(`[Nixasoft Send] Wallet debited: ₹${totalDeduction} (Amount: ₹${numAmount}, Fee: ₹${charge}). Payout row: ${payoutId}`);

    // 2. Execute Nixasoft API Call
    const userPhone = mobileNumber || userProfile.mobile_number || '9999999999';
    const cleanPhone = String(userPhone).replace(/\D/g, '').slice(-10);
    const userEmail = emailId || userProfile.email || 'care@rajwadi.in';

    const apiPayload = {
      amount: String(numAmount),
      mobileNumber: cleanPhone.length === 10 ? cleanPhone : '9999999999',
      requestId: clientRequestId,
      accountNumber: String(accountNumber).trim(),
      ifscCode: String(ifscCode).trim().toUpperCase(),
      beneficiaryName: String(holderName).trim(),
      bankName: String(bankName).trim(),
      transferMode: (['IMPS', 'NEFT', 'RTGS'].includes(transferMode) ? transferMode : 'IMPS') as any,
      emailId: userEmail,
      latitude: String(latitude || '23.0225'),
      longitude: String(longitude || '72.5714')
    };

    const apiResponse = await executeNixasoftPayout(apiPayload);
    console.log('[Nixasoft Send] Payout API Result:', apiResponse);

    // 3. Process API Outcome
    if (apiResponse.statuscode === 'TXN') {
      // SUCCESS
      const utr = apiResponse.data?.utr || apiResponse.data?.apiTxnId || '';
      const apiTxnId = apiResponse.data?.apiTxnId || '';

      await supabaseAdmin
        .from('payout_submissions')
        .update({
          status: 'approved',
          utr_number: utr,
          bank_ref: apiTxnId || utr,
          remark: apiResponse.message || 'Transaction was Successful'
        })
        .eq('id', payoutId);

      return res.json({
        success: true,
        status: 'approved',
        statuscode: 'TXN',
        message: apiResponse.message || 'Transaction was Successful!',
        data: {
          payoutId,
          requestId: clientRequestId,
          apiTxnId,
          utr,
          amount: numAmount,
          charge,
          total_deduction: totalDeduction,
          beneficiaryName: holderName,
          bankName,
          accountNumber,
          ifscCode,
          new_balance: rpcResult.new_balance
        }
      });
    } else if (apiResponse.statuscode === 'TXP') {
      // PENDING
      const apiTxnId = apiResponse.data?.apiTxnId || '';
      const utr = apiResponse.data?.utr || '';

      await supabaseAdmin
        .from('payout_submissions')
        .update({
          status: 'pending',
          bank_ref: apiTxnId,
          utr_number: utr,
          remark: apiResponse.message || 'Transaction is Pending with bank'
        })
        .eq('id', payoutId);

      return res.json({
        success: true,
        status: 'pending',
        statuscode: 'TXP',
        message: apiResponse.message || 'Transaction is Pending with Bank. Status will update shortly.',
        data: {
          payoutId,
          requestId: clientRequestId,
          apiTxnId,
          utr,
          amount: numAmount,
          charge,
          total_deduction: totalDeduction,
          beneficiaryName: holderName,
          bankName,
          accountNumber,
          ifscCode,
          new_balance: rpcResult.new_balance
        }
      });
    } else {
      // FAILED & REFUNDED (TXF or API error)
      const failReason = apiResponse.message || apiResponse.data?.description || 'Transaction Failed & Refunded';

      console.warn(`[Nixasoft Send] Payout failed. Executing immediate refund of ₹${totalDeduction} to user ${userId}`);

      // Auto-Refund wallet balance
      await supabaseAdmin
        .from('users_profiles')
        .update({
          wallet_balance: currentBalance // restore original balance
        })
        .eq('id', userId);

      // Update payout record to rejected/failed
      await supabaseAdmin
        .from('payout_submissions')
        .update({
          status: 'rejected',
          remark: `Nixasoft: ${failReason} (Refunded)`
        })
        .eq('id', payoutId);

      return res.status(400).json({
        success: false,
        status: 'failed',
        statuscode: 'TXF',
        message: `Transaction Failed: ${failReason}. Full ₹${totalDeduction.toFixed(2)} has been refunded to your wallet.`,
        data: {
          payoutId,
          requestId: clientRequestId,
          refunded_amount: totalDeduction,
          balance: currentBalance
        }
      });
    }
  } catch (err: any) {
    console.error('[Nixasoft Send] Fatal error during payout:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error processing payout' });
  }
});

// 9. Status Inquiry for a specific Request ID
router.post('/check-status', async (req, res) => {
  try {
    const { requestId, payoutId } = req.body;
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'requestId is required' });
    }

    const apiStatus = await checkNixasoftStatus(requestId);
    console.log(`[Nixasoft Status] Query for ${requestId}:`, apiStatus);

    if (payoutId) {
      if (apiStatus.statuscode === 'TXN') {
        const utr = apiStatus.data?.utr || apiStatus.data?.apiTxnId || '';
        await supabaseAdmin
          .from('payout_submissions')
          .update({
            status: 'approved',
            utr_number: utr,
            bank_ref: apiStatus.data?.apiTxnId || utr,
            remark: apiStatus.message || 'Transaction was Successful'
          })
          .eq('id', payoutId);
      } else if (apiStatus.statuscode === 'TXF') {
        // Find existing record and refund if not already rejected
        const { data: record } = await supabaseAdmin
          .from('payout_submissions')
          .select('*')
          .eq('id', payoutId)
          .single();

        if (record && record.status !== 'rejected') {
          const refundAmount = Number(record.amount) + Number(record.charge_amount || 0);
          const { data: user } = await supabaseAdmin
            .from('users_profiles')
            .select('wallet_balance')
            .eq('id', record.user_id)
            .single();

          if (user) {
            await supabaseAdmin
              .from('users_profiles')
              .update({
                wallet_balance: Number(user.wallet_balance || 0) + refundAmount
              })
              .eq('id', record.user_id);
          }

          await supabaseAdmin
            .from('payout_submissions')
            .update({
              status: 'rejected',
              remark: `Nixasoft: ${apiStatus.message || 'Transaction Failed & Refunded'}`
            })
            .eq('id', payoutId);
        }
      }
    }

    res.json({
      success: true,
      apiStatus
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Webhook Callback from Nixasoft
router.post('/callback', async (req, res) => {
  try {
    console.log('[Nixasoft Callback] Received payload:', JSON.stringify(req.body));
    const { status, requestId, utr, description } = req.body;

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Missing requestId' });
    }

    // Find record by requestId (txn_id)
    const { data: record } = await supabaseAdmin
      .from('payout_submissions')
      .select('*')
      .eq('txn_id', requestId)
      .single();

    if (!record) {
      console.warn('[Nixasoft Callback] No payout record found for requestId:', requestId);
      return res.json({ success: true, message: 'Acknowledged, no matching record' });
    }

    const normStatus = String(status).toUpperCase();

    if (normStatus === 'SUCCESS') {
      await supabaseAdmin
        .from('payout_submissions')
        .update({
          status: 'approved',
          utr_number: utr || record.utr_number,
          remark: description || 'Bank Transfer Successful'
        })
        .eq('id', record.id);
    } else if (normStatus === 'FAILED') {
      if (record.status !== 'rejected') {
        const refundAmount = Number(record.amount) + Number(record.charge_amount || 0);

        const { data: user } = await supabaseAdmin
          .from('users_profiles')
          .select('wallet_balance')
          .eq('id', record.user_id)
          .single();

        if (user) {
          await supabaseAdmin
            .from('users_profiles')
            .update({
              wallet_balance: Number(user.wallet_balance || 0) + refundAmount
            })
            .eq('id', record.user_id);
        }

        await supabaseAdmin
          .from('payout_submissions')
          .update({
            status: 'rejected',
            remark: `Callback: ${description || 'Transaction Failed & Refunded'}`
          })
          .eq('id', record.id);
      }
    }

    res.json({ success: true, message: 'Callback processed' });
  } catch (err: any) {
    console.error('[Nixasoft Callback] Error processing callback:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
