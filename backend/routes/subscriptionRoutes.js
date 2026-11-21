import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscriptionController.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Public / Authenticated plans catalog
router.get('/plans', SubscriptionController.getPlans);

// Authenticated tenant subscription management
router.get('/current', authMiddleware, tenantMiddleware, SubscriptionController.getCurrentSubscription);
router.get('/entitlements', authMiddleware, tenantMiddleware, SubscriptionController.getEntitlements);
router.get('/usage', authMiddleware, tenantMiddleware, SubscriptionController.getUsageMetrics);
router.get('/billing-history', authMiddleware, tenantMiddleware, SubscriptionController.getBillingHistory);
router.post('/upgrade', authMiddleware, tenantMiddleware, SubscriptionController.upgradePlan);
router.post('/cancel', authMiddleware, tenantMiddleware, SubscriptionController.cancelSubscription);

// Admin-only COGS overview
router.get('/admin/costs', authMiddleware, SubscriptionController.getAdminCostOverview);

export default router;
