import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '5001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PROJECT_NAME: process.env.PROJECT_NAME || 'Bizmate',
  API_V1_STR: process.env.API_V1_STR || '/api/v1',
  SECRET_KEY: process.env.SECRET_KEY || 'bizmate_production_super_secret_key_32_bytes_min',
  ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '10080', 10),

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bizmate',
  SUPABASE_URL: process.env.SUPABASE_URL || null,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || null,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || null,

  // Gemini AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || null,
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL || 'gemini-1.5-flash',

  // WhatsApp Cloud API
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || null,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || 'bizmate_webhook_verify_token_secure',
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || null,
  WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null,
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v21.0',
  META_APP_ID: process.env.META_APP_ID || null,
  META_APP_SECRET: process.env.META_APP_SECRET || null,

  // n8n
  N8N_WEBHOOK_BASE_URL: process.env.N8N_WEBHOOK_BASE_URL || 'http://localhost:5678/webhook',
  N8N_WORKFLOW_KEY: process.env.N8N_WORKFLOW_KEY || 'bizmate_n8n_secret_auth_token_key',

  // Media
  MEDIA_UPLOAD_DIR: process.env.MEDIA_UPLOAD_DIR || 'media/voice_notes',
  MOCK_MODE_IF_NO_CREDENTIALS: process.env.MOCK_MODE_IF_NO_CREDENTIALS === 'false' ? false : true,

  // Razorpay Payment Gateway
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || null,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || null,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || null,
  RAZORPAY_CURRENCY: process.env.RAZORPAY_CURRENCY || 'INR',

  // Sarvam AI Indian Language Engine
  SARVAM_API_KEY: process.env.SARVAM_API_KEY || null,
};
