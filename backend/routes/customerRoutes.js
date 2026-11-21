import { Router } from 'express';
import { CustomerController } from '../controllers/customerController.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';
import { checkQuota } from '../middleware/subscriptionMiddleware.js';

const router = Router();

// Apply auth and tenant resolution to all CRM customer routes
router.use(authMiddleware, tenantMiddleware);

// Supports both /api/v1/crm/customers and /api/v1/crm
router.get(['/customers', '/'], CustomerController.listCustomers);
router.post(['/customers', '/'], checkQuota('crm_contacts'), CustomerController.createCustomer);
router.put(['/customers/:id', '/:id'], CustomerController.updateCustomer);
router.delete(['/customers/:id', '/:id'], CustomerController.deleteCustomer);

export default router;
