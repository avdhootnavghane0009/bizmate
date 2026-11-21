import { config } from '../config/environment.js';
import { UsageService } from './usageService.js';
import { logger } from '../utils/logger.js';

export class N8nService {
  /**
   * Triggers an n8n workflow via webhook
   */
  static async triggerWorkflow(slug, businessId, payload) {
    const targetUrl = `${config.N8N_WEBHOOK_BASE_URL}/${slug}`;
    const headers = {
      'X-Bizmate-Workflow-Key': config.N8N_WORKFLOW_KEY,
      'X-Business-Id': businessId,
      'Content-Type': 'application/json',
    };

    // Track workflow execution in usage metering
    if (businessId) {
      UsageService.recordAutomationExecution(businessId, { slug, success: true }).catch(() => {});
    }

    if (config.MOCK_MODE_IF_NO_CREDENTIALS) {
      return {
        workflow_slug: slug,
        status: 'success',
        orchestrated_by: 'n8n Community Engine (Simulated)',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return { status: 'dispatched', status_code: res.status };
    } catch (err) {
      logger.warn(`n8n triggerWorkflow [${slug}] failed:`, err.message);
      return { status: 'offline_logged', error: err.message };
    }
  }
}
