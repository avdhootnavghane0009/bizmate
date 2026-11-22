import { EntitlementService } from '../services/entitlementService.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware: Enforces that a business has an active entitlement for a specific feature.
 * If not, halts request with HTTP 403 Forbidden and upgrade advice.
 */
export function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res.status(401).json({ error: 'UNAUTHORIZED', detail: 'Missing tenant business context' });
      }

      const check = await EntitlementService.canAccessFeature(businessId, featureKey);
      if (!check.allowed) {
        logger.warn(`Tenant ${businessId} denied access to locked feature: ${featureKey}`);
        return res.status(403).json({
          error: 'FEATURE_NOT_INCLUDED',
          detail: check.reason,
          feature: featureKey,
          current_plan: check.current_plan,
          required_plan: check.required_plan,
          upgrade_url: '/app/settings#plans',
        });
      }

      next();
    } catch (err) {
      const isDbDown = err?.code === 'ECONNREFUSED' || err?.message?.includes('connect') || err?.name === 'AggregateError';
      if (isDbDown) {
        return next();
      }
      next(err);
    }
  };
}

/**
 * Middleware: Enforces that a business has capacity within its quota before consuming a resource.
 * If quota is exhausted, halts request with HTTP 402 Payment Required.
 */
export function checkQuota(resourceKey, requestedAmount = 1) {
  return async (req, res, next) => {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res.status(401).json({ error: 'UNAUTHORIZED', detail: 'Missing tenant business context' });
      }

      const check = await EntitlementService.checkQuota(businessId, resourceKey, requestedAmount);
      if (!check.allowed) {
        logger.warn(`Tenant ${businessId} quota exceeded for resource: ${resourceKey}`);
        return res.status(402).json({
          error: 'QUOTA_EXCEEDED',
          detail: check.reason,
          resource: resourceKey,
          current_usage: check.current_usage,
          limit: check.limit,
          required_plan: check.required_plan,
          upgrade_url: '/app/settings#plans',
        });
      }

      next();
    } catch (err) {
      const isDbDown = err?.code === 'ECONNREFUSED' || err?.message?.includes('connect') || err?.name === 'AggregateError';
      if (isDbDown) {
        return next();
      }
      next(err);
    }
  };
}
