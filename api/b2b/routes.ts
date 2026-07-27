import { Router } from 'express';
import { b2bAuthMiddleware } from './middleware';
import { getCategories, getBillers, fetchBill, payBill, getBalance } from './controller';

const router = Router();

// Apply B2B Auth Middleware to all B2B routes
router.use(b2bAuthMiddleware);

// Get Wallet Balance
router.get('/balance', getBalance);

// Get BillAvenue Categories (from our DB)
router.get('/categories', getCategories);

// Get BillAvenue Billers (from our DB)
router.get('/billers', getBillers);

// Fetch Bill (Calls BillAvenue XML API and returns JSON)
router.post('/fetch-bill', fetchBill);

// Pay Bill (Deducts wallet balance, calls BillAvenue XML API and returns JSON)
router.post('/pay-bill', payBill);

// Additional status check route could be added here
// router.get('/status/:requestId', checkStatus);

export default router;
