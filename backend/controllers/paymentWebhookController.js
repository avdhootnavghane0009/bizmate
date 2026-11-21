/**
 * PaymentWebhookController — Handles Razorpay webhook events.
 *
 * IMPORTANT: This controller reads req.rawBody (Buffer) for signature
 * verification. The raw body is captured in app.js via express.json verify().
 * Never use req.body for signature computation.
 */
import { RazorpayService } from '../services/razorpayService.js';
import { SubscriptionService } from '../services/subscriptionService.js';
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans.js';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Checks idempotency: returns true if this event was already processed.
 */
async function isEventAlreadyProcessed(eventId) {
  if (!eventId) return false;
  const res = await query(
    `SELECT id FROM subscription_events WHERE provider_event_id = $1 LIMIT 1`,
    [eventId]
  );
  return res.rows.length > 0;
}

/**
 * Records a Razorpay event in subscription_events for audit + idempotency.
 */
async function recordEvent(businessId, planId, eventType, providerId, payload) {
  try {
    await query(
      `INSERT INTO subscription_events
       (id, business_id, plan_id, event_type, provider_event_id, payload, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [businessId, planId || null, eventType, providerId, JSON.stringify(payload)]
    );
  } catch (err) {
    logger.warn('[Webhook] Failed to record event:', err.message);
  }
}

export const paymentWebhookController = {
  /**
   * POST /api/v1/webhooks/razorpay
   * Razorpay sends events here on payment capture, failure, etc.
   */
  async handleWebhook(req, res) {
    // 1. Verify signature using raw body
    const rawBody = req.rawBody;
    const signature = req.headers['x-razorpay-signature'];

    if (!rawBody || !signature) {
      logger.warn('[Webhook] Missing raw body or signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const isValid = RazorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn('[Webhook] Invalid signature — rejecting');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // 2. Parse event
    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Malformed JSON' });
    }

    const eventId = event.id;
    const eventType = event.event;
    const payload = event.payload;

    logger.info('[Webhook] Received event:', { eventId, eventType });

    // 3. Idempotency check
    if (await isEventAlreadyProcessed(eventId)) {
      logger.info('[Webhook] Duplicate event ignored:', eventId);
      return res.status(200).json({ received: true, duplicate: true });
    }

    // 4. Route event to handler
    try {
      switch (eventType) {
        case 'payment.captured': {
          await handlePaymentCaptured(payload, eventId);
          break;
        }
        case 'payment.failed': {
          await handlePaymentFailed(payload, eventId);
          break;
        }
        case 'subscription.charged': {
          await handleSubscriptionCharged(payload, eventId);
          break;
        }
        case 'subscription.halted': {
          await handleSubscriptionHalted(payload, eventId);
          break;
        }
        case 'subscription.cancelled': {
          await handleSubscriptionCancelled(payload, eventId);
          break;
        }
        default:
          logger.info('[Webhook] Unhandled event type (ignored):', eventType);
      }
    } catch (err) {
      logger.error('[Webhook] Handler error:', err.message);
      // Return 200 so Razorpay doesn't retry indefinitely
      return res.status(200).json({ received: true, error: err.message });
    }

    return res.status(200).json({ received: true });
  },
};

// ─── Event Handlers ─────────────────────────────────────────────────────────

async function handlePaymentCaptured(payload, eventId) {
  const payment = payload?.payment?.entity;
  if (!payment) return;

  const { id: paymentId, order_id: orderId, notes } = payment;
  const businessId = notes?.business_id;
  const planId = notes?.plan_id;
  const billingCycle = notes?.billing_cycle || 'monthly';

  if (!businessId || !planId) {
    logger.warn('[Webhook:payment.captured] Missing business_id or plan_id in notes', { paymentId });
    return;
  }

  const plan = SUBSCRIPTION_PLANS[planId];
  const amount = plan ? (billingCycle === 'annual' ? plan.annual_price : plan.price) : 0;

  await SubscriptionService.activatePaidSubscription(businessId, planId, {
    paymentProvider: 'razorpay',
    providerPaymentId: paymentId,
    providerOrderId: orderId,
    amount,
    billingCycle,
  });

  await recordEvent(businessId, planId, 'payment.captured', eventId, payload);
  logger.info('[Webhook] payment.captured — subscription activated', { businessId, planId, paymentId });
}

async function handlePaymentFailed(payload, eventId) {
  const payment = payload?.payment?.entity;
  if (!payment) return;

  const { id: paymentId, notes } = payment;
  const businessId = notes?.business_id;
  const planId = notes?.plan_id;

  if (!businessId) return;

  // Mark subscription as past_due (do NOT downgrade immediately — give grace period)
  await query(
    `UPDATE business_subscriptions SET status = 'past_due', updated_at = NOW() WHERE business_id = $1`,
    [businessId]
  );

  await recordEvent(businessId, planId, 'payment.failed', eventId, payload);
  logger.warn('[Webhook] payment.failed — subscription marked past_due', { businessId, paymentId });
}

async function handleSubscriptionCharged(payload, eventId) {
  const subscription = payload?.subscription?.entity;
  const payment = payload?.payment?.entity;
  if (!subscription || !payment) return;

  const { notes } = subscription;
  const businessId = notes?.business_id;
  const planId = notes?.plan_id;
  const billingCycle = notes?.billing_cycle || 'monthly';

  if (!businessId || !planId) return;

  const plan = SUBSCRIPTION_PLANS[planId];
  const amount = plan ? (billingCycle === 'annual' ? plan.annual_price : plan.price) : 0;

  // Renewal — extend billing period
  await SubscriptionService.activatePaidSubscription(businessId, planId, {
    paymentProvider: 'razorpay',
    providerPaymentId: payment.id,
    providerOrderId: null,
    externalSubscriptionId: subscription.id,
    amount,
    billingCycle,
  });

  await recordEvent(businessId, planId, 'subscription.charged', eventId, payload);
  logger.info('[Webhook] subscription.charged — renewed', { businessId, planId });
}

async function handleSubscriptionHalted(payload, eventId) {
  const subscription = payload?.subscription?.entity;
  if (!subscription) return;

  const businessId = subscription.notes?.business_id;
  if (!businessId) return;

  await query(
    `UPDATE business_subscriptions SET status = 'past_due', updated_at = NOW() WHERE business_id = $1`,
    [businessId]
  );

  await recordEvent(businessId, null, 'subscription.halted', eventId, payload);
  logger.warn('[Webhook] subscription.halted — marked past_due', { businessId });
}

async function handleSubscriptionCancelled(payload, eventId) {
  const subscription = payload?.subscription?.entity;
  if (!subscription) return;

  const businessId = subscription.notes?.business_id;
  if (!businessId) return;

  await query(
    `UPDATE business_subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE business_id = $1`,
    [businessId]
  );

  await recordEvent(businessId, null, 'subscription.cancelled', eventId, payload);
  logger.info('[Webhook] subscription.cancelled', { businessId });
}
