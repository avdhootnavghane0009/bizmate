import { query } from '../config/database.js';
import { COST_CONSTANTS, calculateGeminiCost } from '../config/costConstants.js';
import { SubscriptionService } from './subscriptionService.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class UsageService {
  /**
   * Resolves or initializes current active billing period for a business
   */
  static async resolveBillingPeriod(businessId) {
    const sub = await SubscriptionService.getBusinessSubscription(businessId);
    const start = sub.billing_period_start || new Date();
    const end = sub.billing_period_end || new Date(Date.now() + 30 * 86400000);

    // Ensure row exists in tenant_usage
    await query(
      `INSERT INTO tenant_usage 
       (business_id, billing_cycle_start, billing_cycle_end, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (business_id, billing_cycle_start) DO NOTHING`,
      [businessId, start, end]
    );

    return { start, end, subscription: sub };
  }

  /**
   * Records a Gemini AI operation with exact token metrics & credit accounting
   */
  static async recordAiOperation(businessId, {
    operationName = 'default_ai_operation',
    model = 'gemini-3.5-flash-lite',
    promptTokens = 0,
    completionTokens = 0,
    durationSeconds = 0,
    metadata = {},
  }) {
    if (!businessId) return null;

    try {
      const { start, end } = await this.resolveBillingPeriod(businessId);
      const totalTokens = (promptTokens || 0) + (completionTokens || 0);

      // 1. Calculate credit weight
      const creditWeight = COST_CONSTANTS.AI_CREDIT_WEIGHTS[operationName] || 1.0;

      // 2. Calculate estimated Gemini provider cost
      const cost = calculateGeminiCost(promptTokens, completionTokens, durationSeconds);

      // 3. Insert immutable event into usage_events ledger
      const eventId = uuidv4();
      await query(
        `INSERT INTO usage_events 
         (id, business_id, event_type, operation_name, credits_consumed, input_tokens, output_tokens, total_tokens, 
          duration_seconds, model_used, estimated_cost_usd, estimated_cost_inr, metadata, created_at)
         VALUES ($1, $2, 'ai_operation', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [
          eventId,
          businessId,
          operationName,
          creditWeight,
          promptTokens,
          completionTokens,
          totalTokens,
          durationSeconds,
          model,
          cost.usd,
          cost.inr,
          JSON.stringify(metadata),
        ]
      );

      // 4. Atomically update aggregate tenant_usage
      await query(
        `UPDATE tenant_usage 
         SET 
           ai_credits_used = ai_credits_used + $1,
           gemini_requests = gemini_requests + 1,
           gemini_input_tokens = gemini_input_tokens + $2,
           gemini_output_tokens = gemini_output_tokens + $3,
           gemini_total_tokens = gemini_total_tokens + $4,
           audio_seconds_processed = audio_seconds_processed + $5,
           estimated_ai_cost_usd = estimated_ai_cost_usd + $6,
           estimated_ai_cost_inr = estimated_ai_cost_inr + $7,
           updated_at = NOW()
         WHERE business_id = $8 AND billing_cycle_start = $9`,
        [creditWeight, promptTokens, completionTokens, totalTokens, Math.round(durationSeconds), cost.usd, cost.inr, businessId, start]
      );

      return {
        event_id: eventId,
        credits_consumed: creditWeight,
        estimated_cost_inr: cost.inr,
        total_tokens: totalTokens,
      };
    } catch (err) {
      logger.warn('UsageService.recordAiOperation error:', err.message);
      return null;
    }
  }

  /**
   * Records WhatsApp message event with Meta billing category
   */
  static async recordWhatsAppMessage(businessId, {
    direction = 'inbound', // 'inbound' | 'outbound'
    category = 'service',  // 'service' | 'utility' | 'marketing' | 'authentication'
    wamid = null,
    metadata = {},
  }) {
    if (!businessId) return null;

    try {
      const { start } = await this.resolveBillingPeriod(businessId);
      const isOutbound = direction === 'outbound';

      // 1. Insert into usage_events ledger
      await query(
        `INSERT INTO usage_events 
         (id, business_id, event_type, operation_name, credits_consumed, metadata, created_at)
         VALUES ($1, $2, $3, $4, 0.00, $5, NOW())`,
        [
          uuidv4(),
          businessId,
          isOutbound ? 'whatsapp_outbound' : 'whatsapp_inbound',
          `whatsapp_${category}`,
          JSON.stringify({ wamid, direction, category, ...metadata }),
        ]
      );

      // 2. Atomically update aggregate tenant_usage
      let categoryColumn = 'whatsapp_service_conversations';
      if (category === 'utility') categoryColumn = 'whatsapp_utility_messages';
      else if (category === 'marketing') categoryColumn = 'whatsapp_marketing_messages';
      else if (category === 'authentication') categoryColumn = 'whatsapp_auth_messages';

      const counterColumn = isOutbound ? 'whatsapp_outbound_count' : 'whatsapp_inbound_count';

      await query(
        `UPDATE tenant_usage 
         SET 
           ${counterColumn} = ${counterColumn} + 1,
           ${categoryColumn} = ${categoryColumn} + 1,
           updated_at = NOW()
         WHERE business_id = $1 AND billing_cycle_start = $2`,
        [businessId, start]
      );
    } catch (err) {
      logger.warn('UsageService.recordWhatsAppMessage error:', err.message);
    }
  }

  /**
   * Records an n8n automation workflow execution
   */
  static async recordAutomationExecution(businessId, { slug, success = true }) {
    if (!businessId) return null;

    try {
      const { start } = await this.resolveBillingPeriod(businessId);

      await query(
        `INSERT INTO usage_events 
         (id, business_id, event_type, operation_name, credits_consumed, metadata, created_at)
         VALUES ($1, $2, 'automation_execution', $3, 0.00, $4, NOW())`,
        [uuidv4(), businessId, slug, JSON.stringify({ success })]
      );

      await query(
        `UPDATE tenant_usage 
         SET automation_executions = automation_executions + 1, updated_at = NOW()
         WHERE business_id = $1 AND billing_cycle_start = $2`,
        [businessId, start]
      );
    } catch (err) {
      logger.warn('UsageService.recordAutomationExecution error:', err.message);
    }
  }

  /**
   * Returns current billing period usage for a tenant
   */
  static async getTenantUsage(businessId) {
    const { start, end, subscription } = await this.resolveBillingPeriod(businessId);

    const usageRes = await query(
      'SELECT * FROM tenant_usage WHERE business_id = $1 AND billing_cycle_start = $2',
      [businessId, start]
    );

    const usage = usageRes.rows[0] || {};
    const planLimits = subscription.plan.limits;

    const aiUsed = parseFloat(usage.ai_credits_used || 0);
    const aiLimit = planLimits.ai_operations_monthly || 50;

    return {
      business_id: businessId,
      billing_period_start: start,
      billing_period_end: end,
      subscription_plan: subscription.plan.id,
      subscription_status: subscription.status,
      ai_credits: {
        used: aiUsed,
        limit: aiLimit,
        remaining: Math.max(0, aiLimit - aiUsed),
        percent: Math.min(100, Math.round((aiUsed / aiLimit) * 100)),
        requests_count: usage.gemini_requests || 0,
        input_tokens: parseInt(usage.gemini_input_tokens || 0),
        output_tokens: parseInt(usage.gemini_output_tokens || 0),
        total_tokens: parseInt(usage.gemini_total_tokens || 0),
        audio_seconds: usage.audio_seconds_processed || 0,
        estimated_cost_inr: parseFloat(usage.estimated_ai_cost_inr || 0),
      },
      whatsapp: {
        inbound: usage.whatsapp_inbound_count || 0,
        outbound: usage.whatsapp_outbound_count || 0,
        total: (usage.whatsapp_inbound_count || 0) + (usage.whatsapp_outbound_count || 0),
        by_category: {
          service: usage.whatsapp_service_conversations || 0,
          utility: usage.whatsapp_utility_messages || 0,
          marketing: usage.whatsapp_marketing_messages || 0,
          authentication: usage.whatsapp_auth_messages || 0,
        },
        billing_mode: 'BYOC (Merchant Direct Billed by Meta)',
      },
      automation: {
        executions: usage.automation_executions || 0,
        limit: planLimits.automation_workflows,
      },
      storage: {
        bytes_used: parseInt(usage.storage_bytes_used || 0),
        limit_mb: planLimits.storage_mb,
      },
    };
  }

  /**
   * Internal Cost Management (Admin Overview)
   * Aggregates Gemini API expenditure, infra allocation, and estimated margins.
   */
  static async getAdminCostOverview() {
    // 1. Total Gemini API expenditure across all tenants
    const aiAggRes = await query(`
      SELECT 
        COALESCE(SUM(gemini_requests), 0)::int as total_gemini_requests,
        COALESCE(SUM(gemini_input_tokens), 0)::bigint as total_input_tokens,
        COALESCE(SUM(gemini_output_tokens), 0)::bigint as total_output_tokens,
        COALESCE(SUM(gemini_total_tokens), 0)::bigint as total_tokens,
        COALESCE(SUM(audio_seconds_processed), 0)::int as total_audio_seconds,
        COALESCE(SUM(estimated_ai_cost_usd), 0)::numeric as total_cost_usd,
        COALESCE(SUM(estimated_ai_cost_inr), 0)::numeric as total_cost_inr
      FROM tenant_usage
    `);
    const aiAgg = aiAggRes.rows[0];

    // 2. Active tenants by subscription tier & estimated revenue
    const subsRes = await query(`
      SELECT bs.plan_id, COUNT(*)::int as tenant_count, sp.price
      FROM business_subscriptions bs
      JOIN subscription_plans sp ON bs.plan_id = sp.id
      WHERE bs.status IN ('active', 'free')
      GROUP BY bs.plan_id, sp.price
    `);

    let totalMonthlyRevenueINR = 0;
    const tierBreakdown = {};
    for (const row of subsRes.rows) {
      const price = parseFloat(row.price || 0);
      const count = parseInt(row.tenant_count || 0);
      const tierRev = price * count;
      totalMonthlyRevenueINR += tierRev;
      tierBreakdown[row.plan_id] = {
        tenant_count: count,
        price_inr: price,
        monthly_revenue_inr: tierRev,
      };
    }

    const totalAiCostINR = parseFloat(aiAgg.total_cost_inr || 0);
    // Baseline infrastructure allocation (server VPS + DB + domain = ~₹3,600/mo)
    const fixedInfraCostINR = 3600.0;
    const totalCogsINR = totalAiCostINR + fixedInfraCostINR;
    const grossProfitINR = totalMonthlyRevenueINR - totalCogsINR;
    const grossMarginPercent = totalMonthlyRevenueINR > 0
      ? Math.round((grossProfitINR / totalMonthlyRevenueINR) * 1000) / 10
      : 0;

    return {
      revenue: {
        total_mrr_inr: totalMonthlyRevenueINR,
        tiers: tierBreakdown,
      },
      variable_expenses: {
        gemini_api: {
          total_requests: aiAgg.total_gemini_requests,
          input_tokens: aiAgg.total_input_tokens,
          output_tokens: aiAgg.total_output_tokens,
          audio_seconds: aiAgg.total_audio_seconds,
          cost_usd: parseFloat(parseFloat(aiAgg.total_cost_usd).toFixed(4)),
          cost_inr: totalAiCostINR,
        },
      },
      fixed_expenses: {
        infrastructure_inr: fixedInfraCostINR,
        breakdown: 'VPS (₹1,000) + Managed DB (₹2,100) + Storage/CDN (₹400) + Domain (₹100)',
      },
      profitability: {
        total_cogs_inr: parseFloat(totalCogsINR.toFixed(2)),
        gross_profit_inr: parseFloat(grossProfitINR.toFixed(2)),
        gross_margin_percent: grossMarginPercent,
      },
    };
  }
}
