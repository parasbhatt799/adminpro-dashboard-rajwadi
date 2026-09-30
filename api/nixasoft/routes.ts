import { Router } from 'express';
import {
  getNixasoftConfig,
  saveNixasoftConfig,
  calculateSlabCharge,
  executeNixasoftPayout,
  checkNixasoftStatus,
  executeNixasoftVerification,
  PayoutSlab
} from '../../services/nixasoft_payout.js';
import { firePayoutWebhook, atomicRefundB2BPayout } from '../b2b/controller.js';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    realtime: {
      transport: ws as any,
    },
  }
);

const router = Router();

// Helper to sanitize any provider branding (Nixasoft/nixapay -> InstaPay)
const sanitizeText = (txt?: string): string => {
  if (!txt) return '';
  return txt.replace(/nixasoft/gi, 'InstaPay').replace(/nixapay/gi, 'InstaPay');
};

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
      verification_charge: config.verification_charge !== undefined ? config.verification_charge : 3,
      is_verification_enabled: config.is_verification_enabled !== false,
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
    const {
      is_active,
      api_token,
      auth_token,
      min_payout,
      max_payout,
      notice,
      verification_charge,
      is_verification_enabled
    } = req.body;

    const updated = saveNixasoftConfig({
      ...(is_active !== undefined ? { is_active: Boolean(is_active) } : {}),
      ...(api_token !== undefined ? { api_token: String(api_token).trim() } : {}),
      ...(auth_token !== undefined ? { auth_token: String(auth_token).trim() } : {}),
      ...(min_payout !== undefined ? { min_payout: Number(min_payout) } : {}),
      ...(max_payout !== undefined ? { max_payout: Number(max_payout) } : {}),
      ...(notice !== undefined ? { notice: String(notice).trim() } : {}),
      ...(verification_charge !== undefined ? { verification_charge: Number(verification_charge) } : {}),
      ...(is_verification_enabled !== undefined ? { is_verification_enabled: Boolean(is_verification_enabled) } : {})
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
      message: 'Payout settings saved successfully',
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

// 7.5 User: Verify Bank Account via Nixasoft (Charges deducted ONLY on Success)
router.post('/verify-bank', async (req, res) => {
  try {
    const { userId, accountNumber, ifscCode } = req.body;

    if (!userId || !accountNumber || !ifscCode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: userId, accountNumber, and ifscCode are required.'
      });
    }

    const cleanAcc = String(accountNumber).trim();
    const cleanIfsc = String(ifscCode).trim().toUpperCase();

    if (cleanAcc.length < 6 || cleanAcc.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid bank account number (6-30 digits).'
      });
    }

    if (cleanIfsc.length !== 11) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 11-character IFSC code (e.g. HDFC0001234).'
      });
    }

    const config = getNixasoftConfig();
    if (config.is_verification_enabled === false) {
      return res.status(400).json({
        success: false,
        message: 'Bank account verification service is currently disabled by administrator.'
      });
    }

    const verificationFee = Number(config.verification_charge !== undefined ? config.verification_charge : 3);

    // 1. Fetch user profile to verify active status and wallet balance
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('users_profiles')
      .select('id, name, firm_name, wallet_balance, status, mobile_number, email')
      .eq('id', userId)
      .single();

    if (userError || !userProfile) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    if (userProfile.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'Your account is currently inactive.' });
    }

    const currentBalance = Number(userProfile.wallet_balance || 0);

    // Wallet balance check: User must have at least verificationFee + ₹250 reserve
    if (currentBalance - verificationFee < 250) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance for verification fee (₹${verificationFee.toFixed(2)}). You must maintain at least ₹250 in your wallet. Available: ₹${currentBalance.toFixed(2)}, Required: ₹${(verificationFee + 250).toFixed(2)}`
      });
    }

    // 2. Call Nixasoft Bank Verification 1 API
    const clientRequestId = `VR_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationResult = await executeNixasoftVerification({
      accountNumber: cleanAcc,
      ifscCode: cleanIfsc,
      requestId: clientRequestId
    });

    console.log('[Bank Verification API Result]:', verificationResult);

    // 3. Check if verification was SUCCESSFUL
    if (verificationResult.statuscode !== 'TXN' || !verificationResult.data) {
      // Failed! User requested: DO NOT deduct charge when verification fails
      const rawMsg = verificationResult.message || 'Bank account verification failed. Please check Account Number and IFSC Code.';
      const cleanMsg = sanitizeText(rawMsg);
      return res.status(400).json({
        success: false,
        message: cleanMsg,
        statuscode: verificationResult.statuscode
      });
    }

    // 4. SUCCESS! Extract verified bank details
    const verifiedData = verificationResult.data;
    const bankName = verifiedData.bank_name || verifiedData.ifsc_details?.bank || 'Bank';
    const nameAtBank = verifiedData.name_at_bank || 'VERIFIED BENEFICIARY';
    const utr = verifiedData.utr || verifiedData.reference_id || '';

    // Deduct verification charge atomically from wallet
    let payoutId = null;
    try {
      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('submit_auto_payout_request', {
        p_user_id: userId,
        p_bank_name: bankName,
        p_holder_name: nameAtBank,
        p_account_number: cleanAcc,
        p_ifsc_code: cleanIfsc,
        p_amount: 0,
        p_charges: verificationFee,
        p_txn_id: clientRequestId,
        p_status: 'approved',
        p_utr_number: utr
      });

      if (rpcError || !rpcResult?.success) {
        console.warn('[Bank Verification] RPC not available, using atomic update fallback:', rpcError || rpcResult);
        await supabaseAdmin
          .from('users_profiles')
          .update({ wallet_balance: currentBalance - verificationFee })
          .eq('id', userId);

        const { data: subData } = await supabaseAdmin
          .from('payout_submissions')
          .insert([{
            user_id: userId,
            bank_name: bankName,
            account_holder_name: nameAtBank,
            account_number: cleanAcc,
            ifsc_code: cleanIfsc,
            amount: 0,
            charge_amount: verificationFee,
            status: 'approved',
            txn_id: clientRequestId,
            bank_ref: 'VERIFICATION_CHARGE',
            utr_number: utr,
            remark: `A/C Verification Fee debited (₹${verificationFee})`
          }])
          .select()
          .single();
        payoutId = subData?.id;
      } else {
        payoutId = rpcResult.payout_id;
        await supabaseAdmin
          .from('payout_submissions')
          .update({
            bank_ref: 'VERIFICATION_CHARGE',
            remark: `A/C Verification Fee debited (₹${verificationFee})`
          })
          .eq('id', payoutId);
      }
    } catch (deductErr: any) {
      console.error('[Bank Verification] Error debiting verification fee:', deductErr.message);
    }

    // 5. Update beneficiary record if it was already saved
    try {
      const { data: existingBen } = await supabaseAdmin
        .from('payout_beneficiaries')
        .select('id')
        .eq('user_id', userId)
        .eq('account_number', cleanAcc)
        .maybeSingle();

      if (existingBen) {
        await supabaseAdmin
          .from('payout_beneficiaries')
          .update({
            holder_name: nameAtBank,
            bank_name: bankName,
            ifsc_code: cleanIfsc,
            is_verified: true
          })
          .eq('id', existingBen.id);
      }
    } catch (bErr: any) {
      console.warn('[Bank Verification] Beneficiary table update warning:', bErr.message);
    }

    return res.json({
      success: true,
      message: `Bank account verified successfully! Registered Name: ${nameAtBank}`,
      charge_deducted: verificationFee,
      data: {
        name_at_bank: nameAtBank,
        bank_name: bankName,
        branch: verifiedData.branch || verifiedData.ifsc_details?.branch || '',
        city: verifiedData.city || verifiedData.ifsc_details?.city || '',
        utr: utr,
        reference_id: verifiedData.reference_id || clientRequestId,
        account_number: cleanAcc,
        ifsc_code: cleanIfsc,
        is_verified: true
      }
    });

  } catch (err: any) {
    console.error('[Bank Verification Fatal Error]:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error during verification.' });
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
      const cleanMsg = sanitizeText(apiResponse.message || 'Transaction was Successful');

      await supabaseAdmin
        .from('payout_submissions')
        .update({
          status: 'approved',
          utr_number: utr,
          bank_ref: apiTxnId || utr,
          remark: cleanMsg
        })
        .eq('id', payoutId);

      return res.json({
        success: true,
        status: 'approved',
        statuscode: 'TXN',
        message: cleanMsg,
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
      const cleanMsg = sanitizeText(apiResponse.message || 'Transaction is Pending with Bank');

      await supabaseAdmin
        .from('payout_submissions')
        .update({
          status: 'pending',
          bank_ref: apiTxnId,
          utr_number: utr,
          remark: cleanMsg
        })
        .eq('id', payoutId);

      return res.json({
        success: true,
        status: 'pending',
        statuscode: 'TXP',
        message: cleanMsg,
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
      const rawReason = apiResponse.message || apiResponse.data?.description || 'Transaction Failed & Refunded';
      const failReason = sanitizeText(rawReason);

      console.warn(`[Payout Send] Payout failed. Executing immediate refund of ₹${totalDeduction} to user ${userId}`);

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
          remark: `InstaPay: ${failReason} (Refunded)`
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

          const cleanStatus = sanitizeText(apiStatus.message || 'Transaction Failed & Refunded');
          await supabaseAdmin
            .from('payout_submissions')
            .update({
              status: 'rejected',
              remark: `InstaPay: ${cleanStatus}`
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

    const normStatus = String(status).toUpperCase();

    // 1. Check if this is a B2B Payout Transaction
    const { data: b2bTx } = await supabaseAdmin
      .from('b2b_payout_transactions')
      .select('*')
      .eq('order_id', requestId)
      .maybeSingle();

    if (b2bTx) {
      console.log(`[Nixasoft Callback] Matched B2B Payout Transaction: ${b2bTx.order_id}, Status: ${normStatus}`);

      if (normStatus === 'SUCCESS') {
        const finalUtr = utr || b2bTx.utr || null;
        await supabaseAdmin
          .from('b2b_payout_transactions')
          .update({
            status: 'success',
            utr: finalUtr,
            updated_at: new Date().toISOString()
          })
          .eq('id', b2bTx.id);

        try {
          let targetWebhook = b2bTx.request_payload?.webhook_url || b2bTx.request_payload?.callback_url;
          if (!targetWebhook) {
            const { data: cred } = await supabaseAdmin
              .from('b2b_api_credentials')
              .select('webhook_url')
              .eq('id', b2bTx.agent_id)
              .single();
            targetWebhook = cred?.webhook_url;
          }

          firePayoutWebhook(targetWebhook, b2bTx.agent_id, {
            event: 'PAYOUT_STATUS_UPDATE',
            order_id: b2bTx.order_id,
            client_order_id: b2bTx.client_order_id || null,
            utr: finalUtr,
            status: 'success',
            amount: Number(b2bTx.amount),
            base_fee: Number(b2bTx.request_payload?.base_fee || b2bTx.base_charge || Math.round((Number(b2bTx.fee || 0) / 1.18) * 100) / 100),
            gst: Number(b2bTx.request_payload?.gst_amount || b2bTx.gst_amount || Math.round((Number(b2bTx.fee || 0) - (Number(b2bTx.fee || 0) / 1.18)) * 100) / 100),
            fee: Number(b2bTx.fee || 0),
            total_deducted: Number(b2bTx.total_deducted),
            beneficiary_name: b2bTx.beneficiary_name,
            account_number: b2bTx.account_number,
            ifsc_code: b2bTx.ifsc_code,
            timestamp: new Date().toISOString()
          });
        } catch (hookErr: any) {
          console.error('[Nixasoft Callback] Failed to dispatch B2B success webhook:', hookErr.message);
        }
      } else if (normStatus === 'FAILED') {
        const failReason = description || 'Transaction Failed';
        const refundResult = await atomicRefundB2BPayout(b2bTx.order_id, failReason);
        if (refundResult.success) {
          try {
            let targetWebhook = b2bTx.request_payload?.webhook_url || b2bTx.request_payload?.callback_url;
            if (!targetWebhook) {
              const { data: cred } = await supabaseAdmin
                .from('b2b_api_credentials')
                .select('webhook_url')
                .eq('id', b2bTx.agent_id)
                .single();
              targetWebhook = cred?.webhook_url;
            }

            firePayoutWebhook(targetWebhook, b2bTx.agent_id, {
              event: 'PAYOUT_STATUS_UPDATE',
              order_id: b2bTx.order_id,
              client_order_id: b2bTx.client_order_id || null,
              utr: null,
              status: 'failed',
              amount: Number(b2bTx.amount),
              base_fee: Number(b2bTx.request_payload?.base_fee || b2bTx.base_charge || Math.round((Number(b2bTx.fee || 0) / 1.18) * 100) / 100),
              gst: Number(b2bTx.request_payload?.gst_amount || b2bTx.gst_amount || Math.round((Number(b2bTx.fee || 0) - (Number(b2bTx.fee || 0) / 1.18)) * 100) / 100),
              fee: Number(b2bTx.fee || 0),
              total_deducted: Number(b2bTx.total_deducted),
              beneficiary_name: b2bTx.beneficiary_name,
              account_number: b2bTx.account_number,
              ifsc_code: b2bTx.ifsc_code,
              failure_reason: failReason,
              timestamp: new Date().toISOString()
            });
          } catch (hookErr: any) {
            console.error('[Nixasoft Callback] Failed to dispatch B2B failure webhook:', hookErr.message);
          }
        } else {
          console.log(`[Nixasoft Callback] Refund skipped for order ${b2bTx.order_id}: ${refundResult.message}`);
        }
      }
      return res.json({ success: true, message: 'B2B Callback processed successfully' });
    }

    // 2. Fallback to Retail payout_submissions
    const { data: record } = await supabaseAdmin
      .from('payout_submissions')
      .select('*')
      .eq('txn_id', requestId)
      .maybeSingle();

    if (!record) {
      console.warn('[Nixasoft Callback] No payout record found for requestId:', requestId);
      return res.json({ success: true, message: 'Acknowledged, no matching record' });
    }

    if (normStatus === 'SUCCESS') {
      const cleanDesc = sanitizeText(description || 'Bank Transfer Successful');
      await supabaseAdmin
        .from('payout_submissions')
        .update({
          status: 'approved',
          utr_number: utr || record.utr_number,
          remark: cleanDesc
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

        const cleanFail = sanitizeText(description || 'Transaction Failed & Refunded');
        await supabaseAdmin
          .from('payout_submissions')
          .update({
            status: 'rejected',
            remark: `Callback: ${cleanFail}`
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
