/**
 * RazorpayService — All Razorpay API interactions.
 * Operates in mock mode when credentials are missing.
 */
import crypto from 'crypto';
import { config } from '../config/environment.js';
import { getRazorpayClient, isMockMode } from '../config/razorpay.js';
import { logger } from '../utils/logger.js';

export class RazorpayService {
  /**
   * Creates a Razorpay order for one-time plan purchase.
   * @param {number} amountInr  - Amount in INR (integer, NOT paise)
   * @param {string} receipt    - Unique receipt string (e.g. businessId-planId-timestamp)
   * @param {Object} notes      - Arbitrary key/value metadata stored on the order
   */
  static async createOrder(amountInr, receipt, notes = {}) {
    const amountPaise = Math.round(amountInr * 100); // Razorpay expects paise

    if (isMockMode()) {
      logger.info('[Razorpay MOCK] createOrder', { amountInr, receipt });
      return {
        id: `order_MOCK_${Date.now()}`,
        amount: amountPaise,
        currency: 'INR',
        receipt,
        status: 'created',
        mock: true,
      };
    }

    const rz = await getRazorpayClient();
    if (!rz) throw new Error('Razorpay client unavailable');

    const order = await rz.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes,
    });

    logger.info('[Razorpay] Order created', { orderId: order.id, amount: amountInr });
    return order;
  }

  /**
   * Verifies Razorpay payment signature using HMAC-SHA256.
   * This is the ONLY gate that must be passed before activating a subscription.
   *
   * @param {string} razorpayOrderId   - From Razorpay checkout callback
   * @param {string} razorpayPaymentId - From Razorpay checkout callback
   * @param {string} razorpaySignature - From Razorpay checkout callback
   * @returns {boolean} true if signature is valid
   */
  static verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    if (isMockMode()) {
      logger.info('[Razorpay MOCK] verifyPaymentSignature — always returns true in mock mode');
      // In mock mode, accept the special test signature "MOCK_SIGNATURE_OK"
      return razorpaySignature === 'MOCK_SIGNATURE_OK';
    }

    if (!config.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_SECRET not configured');
    }

    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(razorpaySignature, 'hex')
    );

    if (!isValid) {
      logger.warn('[Razorpay] Signature mismatch — possible tampered payment', {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
      });
    }

    return isValid;
  }

  /**
   * Verifies a Razorpay webhook signature using HMAC-SHA256.
   * @param {Buffer} rawBody       - Raw request body Buffer (must NOT be parsed JSON)
   * @param {string} webhookSignature - Value of x-razorpay-signature header
   */
  static verifyWebhookSignature(rawBody, webhookSignature) {
    if (!config.RAZORPAY_WEBHOOK_SECRET) {
      logger.warn('[Razorpay] RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(webhookSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Fetches payment details from Razorpay (for reconciliation).
   */
  static async fetchPayment(paymentId) {
    if (isMockMode()) {
      return {
        id: paymentId,
        status: 'captured',
        amount: 0,
        currency: 'INR',
        mock: true,
      };
    }

    const rz = await getRazorpayClient();
    if (!rz) throw new Error('Razorpay client unavailable');
    return await rz.payments.fetch(paymentId);
  }
}
