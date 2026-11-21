import { query } from '../config/database.js';
import { SUBSCRIPTION_PLANS, getPlanConfig, listPublicPlans } from '../config/subscriptionPlans.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class SubscriptionService {
  /**
   * Returns all available subscription plans with full entitlements & limits.
   */
  static getAvailablePlans() {
    return listPublicPlans();
  }

  /**
   * Retrieves active subscription for a business tenant.
   * If none exists, creates a clean Free Tier record.
   */
  static async getBusinessSubscription(businessId) {
    if (!businessId) {
      throw new Error('businessId is required');
    }

    const sql = `
      SELECT 
        bs.id,
        bs.business_id,
        bs.plan_id,
        bs.status,
        bs.payment_provider,
        bs.external_subscription_id,
        bs.billing_cycle,
        bs.billing_period_start,
        bs.billing_period_end,
        bs.trial_ends_at,
        bs.cancelled_at,
        bs.created_at,
        bs.updated_at,
        b.name as business_name
      FROM business_subscriptions bs
      JOIN businesses b ON bs.business_id = b.id
      WHERE bs.business_id = $1
      LIMIT 1
    `;

    let res = await query(sql, [businessId]);

    // Self-healing: if no record exists, create one with 'free'
    if (res.rows.length === 0) {
      const newSubId = uuidv4();
      await query(
        `INSERT INTO business_subscriptions 
         (id, business_id, plan_id, status, payment_provider, billing_period_start, billing_period_end)
         VALUES ($1, $2, 'free', 'free', 'none', NOW(), NOW() + INTERVAL '30 days')
         ON CONFLICT (business_id) DO NOTHING`,
        [newSubId, businessId]
      );
      res = await query(sql, [businessId]);
    }

    const sub = res.rows[0];
    const planConfig = getPlanConfig(sub?.plan_id || 'free');

    // Check expiration if paid plan has passed billing_period_end
    const now = new Date();
    let currentStatus = sub?.status || 'free';
    if (sub?.billing_period_end && new Date(sub.billing_period_end) < now && currentStatus === 'active') {
      currentStatus = 'past_due';
      await query(
        'UPDATE business_subscriptions SET status = $1, updated_at = NOW() WHERE business_id = $2',
        ['past_due', businessId]
      );
    }

    return {
      id: sub.id,
      business_id: sub.business_id,
      plan_id: sub.plan_id,
      status: currentStatus,
      payment_provider: sub.payment_provider,
      external_subscription_id: sub.external_subscription_id,
      billing_cycle: sub.billing_cycle,
      billing_period_start: sub.billing_period_start,
      billing_period_end: sub.billing_period_end,
      trial_ends_at: sub.trial_ends_at,
      cancelled_at: sub.cancelled_at,
      plan: planConfig,
    };
  }

  /**
   * Activates or updates a paid subscription ONLY after verified payment.
   * This is called strictly by Razorpay webhook or verified payment flow.
   */
  static async activatePaidSubscription(businessId, planId, paymentDetails = {}) {
    const planConfig = SUBSCRIPTION_PLANS[planId];
    if (!planConfig) {
      throw new Error(`Invalid plan_id: ${planId}`);
    }

    const {
      paymentProvider = 'razorpay',
      externalSubscriptionId = null,
      providerPaymentId = null,
      providerOrderId = null,
      amount = planConfig.price,
      billingCycle = 'monthly',
    } = paymentDetails;

    const periodDays = billingCycle === 'annual' ? 365 : 30;

    // 1. Update or Insert business_subscriptions
    await query(
      `INSERT INTO business_subscriptions 
       (id, business_id, plan_id, status, payment_provider, external_subscription_id, billing_cycle, billing_period_start, billing_period_end, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'active', $3, $4, $5, NOW(), NOW() + INTERVAL '${periodDays} days', NOW())
       ON CONFLICT (business_id) DO UPDATE 
       SET 
         plan_id = EXCLUDED.plan_id,
         status = 'active',
         payment_provider = EXCLUDED.payment_provider,
         external_subscription_id = COALESCE(EXCLUDED.external_subscription_id, business_subscriptions.external_subscription_id),
         billing_cycle = EXCLUDED.billing_cycle,
         billing_period_start = NOW(),
         billing_period_end = NOW() + INTERVAL '${periodDays} days',
         cancelled_at = NULL,
         updated_at = NOW()`,
      [businessId, planId, paymentProvider, externalSubscriptionId, billingCycle]
    );

    // 2. Synchronize businesses table
    await query('UPDATE businesses SET plan_id = $1 WHERE id = $2', [planId, businessId]);

    // 3. Record verified payment in subscription_payments
    if (providerPaymentId || providerOrderId) {
      await query(
        `INSERT INTO subscription_payments 
         (id, business_id, amount, currency, payment_provider, provider_payment_id, provider_order_id, status, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'successful', NOW())`,
        [businessId, amount || 0, planConfig.currency || 'INR', paymentProvider, providerPaymentId, providerOrderId]
      );
    }

    // 4. Generate BizMate SaaS invoice
    const invoiceNum = `BZM-INV-${Date.now().toString().slice(-6)}`;
    await query(
      `INSERT INTO subscription_invoices 
       (id, invoice_number, business_id, plan_id, amount, tax_amount, total_amount, currency, status, billing_period_start, billing_period_end, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 0.00, $4, 'INR', 'paid', NOW(), NOW() + INTERVAL '${periodDays} days', NOW())`,
      [invoiceNum, businessId, planId, amount || 0]
    );

    logger.info(`Subscription activated for business ${businessId} on plan: ${planId}`);
    return await this.getBusinessSubscription(businessId);
  }

  /**
   * Cancels a paid subscription (takes effect at end of period).
   */
  static async cancelSubscription(businessId) {
    await query(
      `UPDATE business_subscriptions 
       SET cancelled_at = NOW(), status = 'cancelled', updated_at = NOW() 
       WHERE business_id = $1`,
      [businessId]
    );
    return { success: true, message: 'Subscription cancelled. Access remains active until billing period ends.' };
  }

  /**
   * Fetches billing and invoice history for a tenant.
   */
  static async getBillingHistory(businessId) {
    const invoicesRes = await query(
      `SELECT id, invoice_number, plan_id, amount, tax_amount, total_amount, currency, status, 
              billing_period_start, billing_period_end, created_at
       FROM subscription_invoices 
       WHERE business_id = $1 
       ORDER BY created_at DESC`,
      [businessId]
    );

    const paymentsRes = await query(
      `SELECT id, amount, currency, payment_provider, provider_payment_id, provider_order_id, status, created_at
       FROM subscription_payments 
       WHERE business_id = $1 
       ORDER BY created_at DESC`,
      [businessId]
    );

    return {
      invoices: invoicesRes.rows,
      payments: paymentsRes.rows,
    };
  }
}
