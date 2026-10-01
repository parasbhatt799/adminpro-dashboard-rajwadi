import { Router } from 'express';
import { b2bAuthMiddleware } from './middleware';
import { 
  getCategories, 
  getBillers, 
  fetchBill, 
  payBill, 
  getBalance, 
  checkStatus, 
  checkStatusAdmin, 
  checkPayoutStatusAdmin,
  resendPayoutWebhookAdmin,
  testAgentWebhookAdmin,
  createFundRequest, 
  getFundRequestStatus, 
  getFundRequests, 
  getAdminBankAccounts,
  transferPayout,
  getPayoutStatus,
  getCsplBillerInfo,
  fetchCsplBill,
  payCsplBill,
  checkCsplStatus,
  checkCsplStatusAdmin,
  verifyWithdrawalPinAdmin
} from './controller';

const router = Router();

// Enable CORS for B2B API so it can be called from browsers on other domains
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-api-key, x-secret-key");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

// Admin/Global routes (do not require agent API key auth)
router.get('/admin/status/:transaction_id', checkStatusAdmin);
router.get('/admin/payout/status/:order_id', checkPayoutStatusAdmin);
router.get('/admin/cspl/status/:transaction_id', checkCsplStatusAdmin);
router.get('/cspl/status/:transaction_id', checkCsplStatusAdmin);
router.post('/admin/payout/resend-webhook', resendPayoutWebhookAdmin);
router.post('/admin/agent/test-webhook', testAgentWebhookAdmin);
router.post('/admin/verify-withdrawal-pin', verifyWithdrawalPinAdmin);

// Bypass B2B Auth Middleware for any other admin endpoints (e.g., whatsapp or root server handlers)
router.use('/admin', (req, res, next) => {
  next('router');
});

// Apply B2B Auth Middleware to all B2B partner/agent routes
router.use(b2bAuthMiddleware);

// Get Wallet Balance (Returns BBPS and Payout balances)
router.get('/balance', getBalance);

// Get BillAvenue Categories (from our DB)
router.get('/categories', getCategories);

// Get BillAvenue Billers (from our DB)
router.get('/billers', getBillers);

// Fetch Bill (Calls BillAvenue XML API and returns JSON)
router.post('/fetch-bill', fetchBill);

// Pay Bill (Deducts wallet balance, calls BillAvenue XML API and returns JSON)
router.post('/pay-bill', payBill);

// Check Status of a transaction
router.get('/status/:transaction_id', checkStatus);

// Payout API (Instant 24x7 IMPS / NEFT Bank Transfer)
router.post('/payout/transfer', transferPayout);
router.get('/payout/status/:order_id', getPayoutStatus);

// Get Active Admin Bank Accounts List via API
router.get('/admin-bank-accounts', getAdminBankAccounts);

// Submit Fund Request via API
router.post('/fund-request', createFundRequest);

// Check Fund Request Status via API
router.get('/fund-request/status/:request_id', getFundRequestStatus);

// CSPL Fast Bill Payment API
router.post('/cspl/biller-info', getCsplBillerInfo);
router.post('/cspl/fetch-bill', fetchCsplBill);
router.post('/cspl/pay-bill', payCsplBill);
router.get('/cspl/status/:transaction_id', checkCsplStatus);

export default router;

