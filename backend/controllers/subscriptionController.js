import { SubscriptionService } from '../services/subscriptionService.js';
import { EntitlementService } from '../services/entitlementService.js';
import { UsageService } from '../services/usageService.js';

export class SubscriptionController {
  /**
   * GET /api/v1/subscriptions/plans
   * Returns all available subscription plans with full entitlement details.
   */
  static getPlans(req, res) {
    const plans = SubscriptionService.getAvailablePlans();
    return res.status(200).json(plans);
  }

  /**
   * GET /api/v1/subscriptions/current
   * Returns active subscription for current tenant.
   */
  static async getCurrentSubscription(req, res, next) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res.status(401).json({ detail: 'Missing business tenant context' });
      }

      const subscription = await SubscriptionService.getBusinessSubscription(businessId);
      return res.status(200).json(subscription);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/subscriptions/entitlements
   * Returns real-time usage statistics vs plan limits.
   */
  static async getEntitlements(req, res, next) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res.status(401).json({ detail: 'Missing business tenant context' });
      }

      const data = await EntitlementService.getTenantEntitlements(businessId);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/subscriptions/billing-history
   * Returns past invoices and payment records.
   */
  static async getBillingHistory(req, res, next) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res.status(401).json({ detail: 'Missing business tenant context' });
      }

      const history = await SubscriptionService.getBillingHistory(businessId);
      return res.status(200).json(history);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/subscriptions/upgrade
   * Rejects direct unverified upgrades. Enforces that upgrades require payment checkout.
   */
  static async upgradePlan(req, res) {
    return res.status(400).json({
      error: 'VERIFIED_PAYMENT_REQUIRED',
      detail: 'Direct self-service plan modification without payment verification is disabled. Please initiate payment checkout via Razorpay.',
      checkout_url: '/app/settings#checkout',
    });
  }

  /**
   * POST /api/v1/subscriptions/cancel
   * Cancels active subscription at end of current billing period.
   */
  static async cancelSubscription(req, res, next) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res.status(401).json({ detail: 'Missing business tenant context' });
      }

      const result = await SubscriptionService.cancelSubscription(businessId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/subscriptions/usage
   * Detailed usage and metering breakdown for current tenant
   */
  static async getUsageMetrics(req, res, next) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res.status(401).json({ detail: 'Missing business tenant context' });
      }

      const usage = await UsageService.getTenantUsage(businessId);
      return res.status(200).json(usage);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/subscriptions/admin/costs
   * Internal Admin-only COGS and gross margin cost overview
   */
  static async getAdminCostOverview(req, res, next) {
    try {
      const costs = await UsageService.getAdminCostOverview();
      return res.status(200).json(costs);
    } catch (err) {
      next(err);
    }
  }
}
