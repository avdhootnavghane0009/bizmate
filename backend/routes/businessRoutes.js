import { Router } from 'express';
import { BusinessController } from '../controllers/businessController.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';
import { checkQuota } from '../middleware/subscriptionMiddleware.js';

const router = Router();

// Apply auth and tenant resolution to all business & dashboard routes
router.use(authMiddleware, tenantMiddleware);

// Business Profile & Tenant Configuration
router.get('/business/profile', BusinessController.getBusinessProfile);
router.patch('/business/profile', BusinessController.updateBusinessProfile);
router.get('/business/active', BusinessController.getBusinessProfile);

// Real Database-driven Dashboard Metrics & Overview
router.get('/dashboard/metrics', BusinessController.getDashboardMetrics);
router.get('/dashboard/overview', BusinessController.getDashboardMetrics);

// AI Copilot
router.post('/ai/parse-instruction', checkQuota('ai_operations'), BusinessController.parseInstruction);

// Operations: Products & Inventory
router.get(['/operations/products', '/products'], BusinessController.listProducts);
router.post(['/operations/products', '/products'], BusinessController.createProduct);

// Operations: GST Invoices
router.get(['/operations/invoices', '/invoices'], BusinessController.listInvoices);
router.post(['/operations/invoices', '/invoices'], BusinessController.createInvoice);

// Operations: Orders & Transactions
router.get(['/operations/orders', '/orders'], BusinessController.listOrders);
router.post(['/operations/orders/create', '/orders/create', '/orders'], BusinessController.createOrder);

// Operations: Appointments
router.get(['/operations/appointments', '/appointments'], BusinessController.listAppointments);
router.post(['/operations/appointments', '/appointments'], BusinessController.createAppointment);

router.post('/internal/business-ops/validate-and-execute', BusinessController.validateAndExecute);

// Admin Metrics
router.get('/admin/metrics', BusinessController.getAdminMetrics);

// Integrations Hub status
router.get('/integrations/status', BusinessController.getIntegrationsStatus);

export default router;
