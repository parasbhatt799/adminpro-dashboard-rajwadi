import { Router } from 'express';
import * as dmtService from '../../services/dmtService.js';
import { supabaseAdmin } from '../../server.js';

const router = Router();

// 1. DMT Configuration & Status
router.get('/config', async (req, res) => {
  try {
    res.json({
      success: true,
      instituteId: dmtService.DMT_CONFIG.INSTITUTE_ID,
      accessCode: dmtService.DMT_CONFIG.ACCESS_CODE,
      environment: dmtService.DMT_CONFIG.IS_PROD ? 'production' : 'staging_uat',
      version: dmtService.DMT_CONFIG.VERSION,
      channels: ['ARTL', 'FINO'],
      allowSandboxFallback: dmtService.DMT_CONFIG.ALLOW_SANDBOX_FALLBACK
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Bank List
router.get('/banks', async (req, res) => {
  try {
    const txnType = (req.query.txnType as any) || 'IMPS';
    const result = await dmtService.getBankList(txnType);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Sender Details / Search
router.get('/sender/:mobile', async (req, res) => {
  try {
    const { mobile } = req.params;
    const txnType = (req.query.txnType as any) || 'IMPS';
    const bankId = (req.query.bankId as any) || 'ARTL';

    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
    }

    const result = await dmtService.getSenderDetails(mobile, txnType, bankId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Register Sender
router.post('/sender/register', async (req, res) => {
  try {
    const { senderMobileNumber, senderName, senderPin, aadharNumber, bioPid, bioType, bankId, txnType } = req.body;
    if (!senderMobileNumber || !senderName || !senderPin) {
      return res.status(400).json({ success: false, error: 'senderMobileNumber, senderName, and senderPin are required' });
    }

    const result = await dmtService.registerSender({
      senderMobileNumber,
      senderName,
      senderPin,
      aadharNumber,
      bioPid,
      bioType,
      bankId,
      txnType
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Verify Sender OTP
router.post('/sender/verify-otp', async (req, res) => {
  try {
    const { senderMobileNumber, otp, additionalRegData, bankId, txnType, aadharNumber, bioPid, bioType } = req.body;
    if (!senderMobileNumber || !otp) {
      return res.status(400).json({ success: false, error: 'senderMobileNumber and otp are required' });
    }

    const result = await dmtService.verifySenderOtp({
      senderMobileNumber,
      otp,
      additionalRegData,
      bankId,
      txnType,
      aadharNumber,
      bioPid,
      bioType
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Resend Sender OTP
router.post('/sender/resend-otp', async (req, res) => {
  try {
    const { senderMobileNumber, txnType, bankId } = req.body;
    if (!senderMobileNumber) {
      return res.status(400).json({ success: false, error: 'senderMobileNumber is required' });
    }

    const result = await dmtService.resendSenderOtp(senderMobileNumber, txnType, bankId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get All Recipients
router.get('/recipients/:mobile', async (req, res) => {
  try {
    const { mobile } = req.params;
    const txnType = (req.query.txnType as any) || 'IMPS';
    const bankId = (req.query.bankId as any) || 'ARTL';

    if (!mobile) {
      return res.status(400).json({ success: false, error: 'Mobile number required' });
    }

    const result = await dmtService.getAllRecipients(mobile, txnType, bankId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Add Recipient
router.post('/recipient/add', async (req, res) => {
  try {
    const {
      senderMobileNumber,
      recipientName,
      recipientMobileNumber,
      bankCode,
      bankAccountNumber,
      ifsc,
      txnType,
      bankId
    } = req.body;

    if (!senderMobileNumber || !recipientName || !bankAccountNumber || !ifsc) {
      return res.status(400).json({ success: false, error: 'senderMobileNumber, recipientName, bankAccountNumber, and ifsc are required' });
    }

    const result = await dmtService.addRecipient({
      senderMobileNumber,
      recipientName,
      recipientMobileNumber: recipientMobileNumber || senderMobileNumber,
      bankCode: bankCode || ifsc.substring(0, 4),
      bankAccountNumber,
      ifsc,
      txnType,
      bankId
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Delete Recipient
router.post('/recipient/delete', async (req, res) => {
  try {
    const { senderMobileNumber, recipientId, txnType, bankId } = req.body;
    if (!senderMobileNumber || !recipientId) {
      return res.status(400).json({ success: false, error: 'senderMobileNumber and recipientId are required' });
    }

    const result = await dmtService.deleteRecipient({
      senderMobileNumber,
      recipientId,
      txnType,
      bankId
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Verify Bank Account (Penny Drop)
router.post('/recipient/verify-account', async (req, res) => {
  try {
    const { senderMobileNumber, bankAccountNumber, ifsc, bankCode } = req.body;
    if (!senderMobileNumber || !bankAccountNumber || !ifsc) {
      return res.status(400).json({ success: false, error: 'senderMobileNumber, bankAccountNumber, and ifsc are required' });
    }

    const result = await dmtService.verifyBankAccount({
      senderMobileNumber,
      bankAccountNumber,
      ifsc,
      bankCode: bankCode || ifsc.substring(0, 4)
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Fund Transfer - Step 1: Send OTP (TXNSENDOTP)
router.post('/transfer/send-otp', async (req, res) => {
  try {
    const { senderMobileNo, recipientId, amount, convFee, txnType, bankId } = req.body;
    if (!senderMobileNo || !recipientId || !amount) {
      return res.status(400).json({ success: false, error: 'senderMobileNo, recipientId, and amount are required' });
    }

    if (Number(amount) > 5000) {
      return res.status(400).json({ success: false, error: 'As per BillAvenue DMT v1.7+, maximum limit per single transaction is Rs. 5,000' });
    }

    const result = await dmtService.sendTransferOtp({
      senderMobileNo,
      recipientId,
      amountRupees: Number(amount),
      convFeeRupees: Number(convFee || 10),
      txnType: txnType || 'IMPS',
      bankId: bankId || 'ARTL'
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Fund Transfer - Step 2: Verify OTP & Execute (TXNVERIFYOTP)
router.post('/transfer/verify-otp', async (req, res) => {
  try {
    const { senderMobileNo, recipientId, amount, convFee, txnType, otp, recipientDetails, userId } = req.body;
    if (!senderMobileNo || !recipientId || !amount || !otp) {
      return res.status(400).json({ success: false, error: 'senderMobileNo, recipientId, amount, and otp are required' });
    }

    const result = await dmtService.verifyTransferOtpAndPay({
      senderMobileNo,
      recipientId,
      amountRupees: Number(amount),
      convFeeRupees: Number(convFee || 10),
      txnType: txnType || 'IMPS',
      otp
    });

    // Optionally record transaction in DB if result is successful
    if (result.success && result.data) {
      try {
        const detail = result.data.fundTransferDetails?.fundDetail || {};
        await supabaseAdmin.from('dmt_transactions').insert({
          user_id: userId || null,
          sender_mobile: senderMobileNo,
          recipient_id: recipientId,
          recipient_name: recipientDetails?.recipientName || detail.impsName || 'Beneficiary',
          bank_account: recipientDetails?.bankAccountNumber || null,
          ifsc: recipientDetails?.ifsc || null,
          bank_name: recipientDetails?.bankName || null,
          amount: Number(amount),
          charge_amount: Number(convFee || 10),
          txn_type: txnType || 'IMPS',
          unique_ref_id: result.data.uniqueRefId || detail.uniqueRefId,
          bank_txn_id: detail.bankTxnId,
          dmt_txn_id: detail.DmtTxnId,
          ref_id: detail.refId,
          txn_status: detail.txnStatus || 'C',
          raw_response: result.data
        });
      } catch (dbErr: any) {
        // Table might not exist yet; do not fail the transfer response
        console.warn('[DMT Router] Could not insert to dmt_transactions table:', dbErr.message);
      }
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Transaction Status Enquiry (MultiTxnStatus)
router.get('/transaction/status/:uniqueRefId', async (req, res) => {
  try {
    const { uniqueRefId } = req.params;
    if (!uniqueRefId) {
      return res.status(400).json({ success: false, error: 'uniqueRefId is required' });
    }

    const result = await dmtService.checkDmtTxnStatus(uniqueRefId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Initiate Refund (TxnRefund)
router.post('/transaction/refund-otp', async (req, res) => {
  try {
    const { dmtTxnId } = req.body;
    if (!dmtTxnId) {
      return res.status(400).json({ success: false, error: 'dmtTxnId is required' });
    }

    const result = await dmtService.initiateDmtRefund(dmtTxnId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Verify Refund OTP (VerifyRefundOtp)
router.post('/transaction/verify-refund', async (req, res) => {
  try {
    const { dmtTxnId, uniqueRefId, otp } = req.body;
    if (!dmtTxnId || !uniqueRefId || !otp) {
      return res.status(400).json({ success: false, error: 'dmtTxnId, uniqueRefId, and otp are required' });
    }

    const result = await dmtService.verifyRefundOtp({ dmtTxnId, uniqueRefId, otp });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16. Deposit Balance
router.get('/deposit-balance', async (req, res) => {
  try {
    const result = await dmtService.checkDmtDepositBalance();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 17. Recent DMT Transactions History
router.get('/history', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('dmt_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.json({ success: true, transactions: [] });
    }
    res.json({ success: true, transactions: data || [] });
  } catch (err: any) {
    res.json({ success: true, transactions: [] });
  }
});

export default router;
