import { query } from '../config/database.js';
import { SubscriptionService } from './subscriptionService.js';
import { UsageService } from './usageService.js';
import { logger } from '../utils/logger.js';

export class EntitlementService {
  /**
   * Check if a business has access to a specific boolean feature.
   */
  static async canAccessFeature(businessId, featureKey) {
    const sub = await SubscriptionService.getBusinessSubscription(businessId);
    const plan = sub.plan;
    const isAllowed = Boolean(plan.features?.[featureKey]);

    if (!isAllowed) {
      let minimumPlan = 'growth';
      if (['priority_support'].includes(featureKey)) minimumPlan = 'pro';
      if (['voice_notes'].includes(featureKey)) minimumPlan = 'starter';

      return {
        allowed: false,
        feature: featureKey,
        current_plan: plan.id,
        required_plan: minimumPlan,
        reason: `Feature '${featureKey}' is not included in the ${plan.name} plan. Upgrade to ${minimumPlan.toUpperCase()} to unlock.`,
      };
    }

    return { allowed: true, feature: featureKey, current_plan: plan.id };
  }

  /**
   * Check if a business has capacity within its quota for a specific resource.
   */
  static async checkQuota(businessId, resourceKey, requestedAmount = 1) {
    const sub = await SubscriptionService.getBusinessSubscription(businessId);
    const plan = sub.plan;
    const limits = plan.limits || {};

    let currentUsage = 0;
    let maxAllowed = limits[resourceKey] || 0;

    switch (resourceKey) {
      case 'crm_contacts': {
        const res = await query('SELECT COUNT(*)::int as count FROM customers WHERE business_id = $1', [businessId]);
        currentUsage = res.rows[0]?.count || 0;
        maxAllowed = limits.crm_contacts || 100;
        break;
      }
      case 'staff_accounts': {
        const res = await query('SELECT COUNT(*)::int as count FROM users WHERE business_id = $1', [businessId]);
        currentUsage = res.rows[0]?.count || 0;
        maxAllowed = limits.staff_accounts || 1;
        break;
      }
      case 'automation_workflows': {
        // Active workflows in n8n/bizmate
        maxAllowed = limits.automation_workflows || 1;
        currentUsage = 1; // baseline active orchestrator
        break;
      }
      case 'voice_processing': {
        if (!limits.voice_processing) {
          return {
            allowed: false,
            resource: resourceKey,
            current_usage: 0,
            limit: 0,
            reason: `Voice-note processing is not available on the ${plan.name} plan. Upgrade to STARTER or higher.`,
            required_plan: 'starter',
          };
        }
        return { allowed: true, resource: resourceKey, limit: limits.voice_seconds_monthly };
      }
      case 'ai_operations': {
        const periodStart = sub.billing_period_start || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const usageRes = await query(
          'SELECT ai_credits_used FROM tenant_usage WHERE business_id = $1 AND billing_cycle_start = $2',
          [businessId, periodStart]
        );
        if (usageRes.rows.length > 0 && usageRes.rows[0].ai_credits_used !== null && parseFloat(usageRes.rows[0].ai_credits_used) > 0) {
          currentUsage = parseFloat(usageRes.rows[0].ai_credits_used);
        } else {
          const res = await query(
            `SELECT COUNT(*)::int as count 
             FROM messages 
             WHERE business_id = $1 AND sender_type = 'ai' AND created_at >= $2`,
            [businessId, periodStart]
          );
          currentUsage = res.rows[0]?.count || 0;
        }
        maxAllowed = limits.ai_operations_monthly || 50;
        break;
      }
      default:
        return { allowed: true, resource: resourceKey };
    }

    if (currentUsage + requestedAmount > maxAllowed) {
      return {
        allowed: false,
        resource: resourceKey,
        current_usage: currentUsage,
        limit: maxAllowed,
        remaining: Math.max(0, maxAllowed - currentUsage),
        reason: `Quota exceeded for ${resourceKey}. Current: ${currentUsage}/${maxAllowed}. Upgrade your plan for higher limits.`,
        required_plan: plan.id === 'free' ? 'starter' : (plan.id === 'starter' ? 'growth' : 'pro'),
      };
    }

    return {
      allowed: true,
      resource: resourceKey,
      current_usage: currentUsage,
      limit: maxAllowed,
      remaining: Math.max(0, maxAllowed - (currentUsage + requestedAmount)),
    };
  }

  /**
   * Retrieves full dashboard of entitlements and live usage for a business.
   */
  static async getTenantEntitlements(businessId) {
    const sub = await SubscriptionService.getBusinessSubscription(businessId);
    const plan = sub.plan;
    const periodStart = sub.billing_period_start || new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // 1. Live CRM contacts count
    const custRes = await query('SELECT COUNT(*)::int as count FROM customers WHERE business_id = $1', [businessId]);
    const contactsCount = custRes.rows[0]?.count || 0;

    // 2. Live Staff accounts count
    const staffRes = await query('SELECT COUNT(*)::int as count FROM users WHERE business_id = $1', [businessId]);
    const staffCount = staffRes.rows[0]?.count || 0;

    // 3. Detailed Tenant Usage from UsageService
    const tenantUsage = await UsageService.getTenantUsage(businessId);
    const aiOpsCount = tenantUsage.ai_credits.used > 0
      ? tenantUsage.ai_credits.used
      : (await query(
          `SELECT COUNT(*)::int as count 
           FROM messages 
           WHERE business_id = $1 AND sender_type = 'ai' AND created_at >= $2`,
          [businessId, periodStart]
        )).rows[0]?.count || 0;

    // 4. Inbound & Outbound WhatsApp messages
    const waInbound = tenantUsage.whatsapp.inbound;
    const waOutbound = tenantUsage.whatsapp.outbound;

    return {
      subscription: sub,
      limits: plan.limits,
      features: plan.features,
      usage: {
        crm_contacts: {
          used: contactsCount,
          limit: plan.limits.crm_contacts,
          percent: Math.min(100, Math.round((contactsCount / plan.limits.crm_contacts) * 100)),
        },
        staff_accounts: {
          used: staffCount,
          limit: plan.limits.staff_accounts,
          percent: Math.min(100, Math.round((staffCount / plan.limits.staff_accounts) * 100)),
        },
        ai_operations: {
          used: aiOpsCount,
          limit: plan.limits.ai_operations_monthly,
          remaining: Math.max(0, plan.limits.ai_operations_monthly - aiOpsCount),
          percent: Math.min(100, Math.round((aiOpsCount / plan.limits.ai_operations_monthly) * 100)),
          tokens: tenantUsage.ai_credits.total_tokens,
          estimated_cost_inr: tenantUsage.ai_credits.estimated_cost_inr,
        },
        whatsapp: {
          inbound: waInbound,
          outbound: waOutbound,
          total: waInbound + waOutbound,
          by_category: tenantUsage.whatsapp.by_category,
          billing_mode: tenantUsage.whatsapp.billing_mode,
        },
        automation_workflows: {
          used: tenantUsage.automation.executions > 0 ? tenantUsage.automation.executions : 1,
          limit: plan.limits.automation_workflows,
          percent: Math.min(100, Math.round((1 / plan.limits.automation_workflows) * 100)),
        },
        storage: tenantUsage.storage,
      },
    };
  }
}
