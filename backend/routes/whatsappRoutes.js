import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsappController.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Public Webhook endpoints for Meta WhatsApp Cloud API
router.get('/webhooks/whatsapp', WhatsAppController.verifyWebhook);
router.post('/webhooks/whatsapp', WhatsAppController.receiveWebhook);

// Protected WhatsApp Account Settings endpoints
router.get('/settings/whatsapp/status', authMiddleware, tenantMiddleware, WhatsAppController.getStatus);
router.post('/settings/whatsapp/connect', authMiddleware, tenantMiddleware, WhatsAppController.connectAccount);

export default router;
