import { Router } from 'express';
import { AutomationController } from '../controllers/automationController.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';
import { checkQuota } from '../middleware/subscriptionMiddleware.js';

const router = Router();

// Apply auth and tenant resolution to all automation routes
router.use(authMiddleware, tenantMiddleware);

router.get('/workflows', AutomationController.listWorkflows);
router.post('/trigger', checkQuota('automation_workflows'), AutomationController.triggerWorkflow);

export default router;
