import express from 'express';
import cors from 'cors';
import { config } from './config/environment.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';

// Route modules
import authRoutes from './routes/authRoutes.js';
import inboxRoutes from './routes/inboxRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import businessRoutes from './routes/businessRoutes.js';
import automationRoutes from './routes/automationRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

const app = express();

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server, curl, mobile, or webhook requests with no origin
    if (!origin) return callback(null, true);
    
    // Allow localhost, any Netlify preview/production, Vercel, and Render origins
    if (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.endsWith('.netlify.app') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.onrender.com') ||
      origin.includes('bizmate')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));

// Capture raw body for WhatsApp webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

// Root health check endpoint
app.get('/', (req, res) => {
  res.json({
    project: config.PROJECT_NAME,
    phase: 'Phase 2 — AI Intelligence, WhatsApp Cloud API & n8n Automation (Node.js + Express)',
    gemini_model: config.GEMINI_MODEL,
    whatsapp_api: config.WHATSAPP_API_VERSION,
    status: 'online',
  });
});

// API Routes mounted under /api/v1
const API_PREFIX = config.API_V1_STR;

app.use(API_PREFIX, authRoutes);
// Payment routes BEFORE subscriptions (webhook has no auth)
app.use(API_PREFIX, paymentRoutes);
app.use(`${API_PREFIX}/subscriptions`, subscriptionRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use(`${API_PREFIX}/inbox`, inboxRoutes);
app.use(API_PREFIX, whatsappRoutes);
app.use(`${API_PREFIX}/crm`, customerRoutes);
app.use(API_PREFIX, customerRoutes);
app.use(API_PREFIX, businessRoutes);
app.use(`${API_PREFIX}/automation`, automationRoutes);

// Centralized error handling
app.use(errorMiddleware);

export default app;
