/**
 * Payment Routes
 * - POST /api/v1/payments/create-order  → Create Razorpay order
 * - POST /api/v1/payments/verify        → Verify signature & activate subscription
 * - POST /api/v1/webhooks/razorpay      → Razorpay webhook (uses raw body)
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/authMiddleware.js';
import { paymentController } from '../controllers/paymentController.js';
import { paymentWebhookController } from '../controllers/paymentWebhookController.js';

const router = Router();

// ─── Webhook (no auth — verified by HMAC signature) ─────────────────────────
// MUST be registered BEFORE auth middleware so the raw body is still accessible.
// Raw body is already captured by app.js express.json({ verify }) hook.
router.post('/webhooks/razorpay', paymentWebhookController.handleWebhook);

// ─── Authenticated Payment Endpoints ─────────────────────────────────────────
router.post('/payments/create-order', authMiddleware, tenantMiddleware, paymentController.createOrder);
router.post('/payments/verify', authMiddleware, tenantMiddleware, paymentController.verifyPayment);

export default router;
