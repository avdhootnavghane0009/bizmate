import { Router } from 'express';
import { InboxController } from '../controllers/inboxController.js';
import { authMiddleware, tenantMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Test / Simulator ingestion pipeline (public / unauthenticated)
router.post('/simulate-message', InboxController.simulateMessage);

// Protected Inbox routes
router.use(authMiddleware, tenantMiddleware);
router.get('/conversations', InboxController.getConversations);
router.get('/conversations/:conversationId/messages', InboxController.getMessages);
router.post('/send', InboxController.sendMessage);
router.post('/conversations/:conversationId/lock', InboxController.toggleLock);

export default router;
