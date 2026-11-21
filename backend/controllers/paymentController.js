/**
 * PaymentController — Handles Razorpay order creation and payment verification.
 * Never activates subscriptions directly — defers to SubscriptionService
 * which is called only after cryptographic signature verification.
 */
import { RazorpayService } from '../services/razorpayService.js';
import { SubscriptionService } from '../services/subscriptionService.js';
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans.js';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

export const paymentController = {
  /**
   * POST /api/v1/payments/create-order
   * Creates a Razorpay order for plan upgrade.
   * Returns order_id and key_id to the frontend (key_secret stays on server).
   */
  async createOrder(req, res) {
    try {
      const businessId = req.businessId || req.user?.business_id || req.currentBusiness?.id || req.business?.id;
      if (!businessId) {
        return res.status(401).json({ error: 'Unauthorized: business context missing' });
      }

      const { plan_id, billing_cycle = 'monthly' } = req.body;

      if (!plan_id) {
        return res.status(400).json({ error: 'plan_id is required' });
      }

      const plan = SUBSCRIPTION_PLANS[plan_id];
      if (!plan) {
        return res.status(400).json({ error: `Unknown plan: ${plan_id}` });
      }

      if (plan.price === 0) {
        return res.status(400).json({ error: 'Free plan does not require payment' });
      }

      if (plan_id === 'enterprise') {
        return res.status(400).json({
          error: 'Enterprise plans require manual configuration. Contact sales@bizmate.in',
        });
      }

      // Verify current subscription to prevent double-charging same plan
      const current = await SubscriptionService.getBusinessSubscription(businessId);
      if (current.plan_id === plan_id && current.status === 'active') {
        return res.status(409).json({
          error: `You are already on the ${plan.name} plan and your subscription is active.`,
        });
      }

      const amount = billing_cycle === 'annual' ? plan.annual_price : plan.price;
      const receipt = `BZM-${businessId.slice(0, 8)}-${plan_id}-${Date.now()}`;

      const order = await RazorpayService.createOrder(amount, receipt, {
        business_id: businessId,
        plan_id,
        billing_cycle,
      });

      logger.info('[Payment] Order created', { businessId, plan_id, amount, orderId: order.id });

      return res.status(200).json({
        order_id: order.id,
        amount: order.amount,          // in paise
        currency: order.currency,
        key_id: config.RAZORPAY_KEY_ID || 'rzp_test_MOCK',
        plan_name: plan.name,
        billing_cycle,
        mock: order.mock || false,
      });
    } catch (err) {
      logger.error('[Payment] createOrder error:', err.message);
      return res.status(500).json({ error: 'Failed to create payment order' });
    }
  },

  /**
   * POST /api/v1/payments/verify
   * Verifies Razorpay signature and activates subscription on success.
   * This is the ONLY server-side gate for subscription activation from checkout.
   */
  async verifyPayment(req, res) {
    try {
      const businessId = req.businessId || req.user?.business_id || req.currentBusiness?.id || req.business?.id;
      if (!businessId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        plan_id,
        billing_cycle = 'monthly',
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan_id) {
        return res.status(400).json({
          error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id',
        });
      }

      const plan = SUBSCRIPTION_PLANS[plan_id];
      if (!plan) {
        return res.status(400).json({ error: `Unknown plan: ${plan_id}` });
      }

      // CRITICAL: Verify signature before ANY subscription change
      const isValid = RazorpayService.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        logger.warn('[Payment] Invalid signature attempt', { businessId, razorpay_order_id });
        return res.status(400).json({ error: 'Payment signature verification failed. Payment not processed.' });
      }

      // Activate subscription only after verified signature
      const amount = billing_cycle === 'annual' ? plan.annual_price : plan.price;
      const subscription = await SubscriptionService.activatePaidSubscription(businessId, plan_id, {
        paymentProvider: 'razorpay',
        providerPaymentId: razorpay_payment_id,
        providerOrderId: razorpay_order_id,
        amount,
        billingCycle: billing_cycle,
      });

      logger.info('[Payment] Subscription activated after verified payment', {
        businessId,
        plan_id,
        razorpay_payment_id,
      });

      return res.status(200).json({
        success: true,
        message: `Subscription upgraded to ${plan.name}`,
        subscription,
      });
    } catch (err) {
      logger.error('[Payment] verifyPayment error:', err.message);
      return res.status(500).json({ error: 'Payment verification failed' });
    }
  },
};
