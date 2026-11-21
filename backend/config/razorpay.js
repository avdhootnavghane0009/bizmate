/**
 * Razorpay Client Configuration
 * Lazily initialized so the app starts even without credentials (mock mode).
 */
import { config } from './environment.js';
import { logger } from '../utils/logger.js';

let _razorpayInstance = null;

/**
 * Returns a live Razorpay instance or null if credentials are absent.
 * Import Razorpay lazily so the app boots without the package in mock mode.
 */
export async function getRazorpayClient() {
  if (_razorpayInstance) return _razorpayInstance;

  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    logger.warn('[Razorpay] Credentials missing — running in mock mode.');
    return null;
  }

  try {
    const { default: Razorpay } = await import('razorpay');
    _razorpayInstance = new Razorpay({
      key_id: config.RAZORPAY_KEY_ID,
      key_secret: config.RAZORPAY_KEY_SECRET,
    });
    logger.info('[Razorpay] Client initialized.');
    return _razorpayInstance;
  } catch (err) {
    logger.error('[Razorpay] Failed to initialize client:', err.message);
    return null;
  }
}

export const isMockMode = () =>
  !config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET || config.MOCK_MODE_IF_NO_CREDENTIALS;
