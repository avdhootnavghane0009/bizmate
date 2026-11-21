import { Router } from 'express';
import { z } from 'zod';
import { AuthController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validationMiddleware } from '../middleware/validationMiddleware.js';

const router = Router();

const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
};

const registerSchema = {
  body: z.object({
    business_name: z.string().min(1),
    industry_id: z.string().optional().default('general'),
    phone_number: z.string().optional(),
    email: z.string().email(),
    password: z.string().min(6),
    owner_name: z.string().optional(),
    currency: z.string().optional().default('INR'),
  }),
};

router.post('/auth/login', validationMiddleware(loginSchema), AuthController.login);
router.post('/auth/register', validationMiddleware(registerSchema), AuthController.register);
router.post('/onboarding/register', validationMiddleware(registerSchema), AuthController.register);
router.get('/auth/me', authMiddleware, AuthController.getMe);

export default router;
