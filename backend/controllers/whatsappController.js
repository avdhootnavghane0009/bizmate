import { WhatsAppService } from '../services/whatsappService.js';
import { WhatsAppPipeline } from '../services/whatsappPipeline.js';
import { query } from '../config/database.js';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { encrypt } from '../utils/encryption.js';

export class WhatsAppController {
  /**
   * GET /api/v1/webhooks/whatsapp
   * Meta WhatsApp Webhook Handshake verification
   */
  static verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
      logger.info('WhatsApp webhook handshake verified successfully.');
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(challenge);
    }

    logger.warn('WhatsApp webhook verification rejected. Invalid token or mode.');
    return res.status(403).send('Verification Failed');
  }

  /**
   * POST /api/v1/webhooks/whatsapp
   * Incoming WhatsApp events from Meta
   */
  static async receiveWebhook(req, res, next) {
    try {
      const signature = req.headers['x-hub-signature-256'];
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

      if (!WhatsAppService.verifyWebhookSignature(rawBody, signature)) {
        logger.warn('WhatsApp webhook signature verification failed.');
        return res.status(403).send('Invalid Signature');
      }

      // Process in background asynchronously
      setImmediate(async () => {
        try {
          await WhatsAppPipeline.processIncomingPayload(req.body);
        } catch (err) {
          logger.error('Background webhook processing error:', err);
        }
      });

      return res.status(200).json({ status: 'received' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/settings/whatsapp/status
   */
  static async getStatus(req, res, next) {
    try {
      const bizId = req.currentBusiness?.id;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bizId);

      if (isUuid) {
        try {
          const result = await query(
            'SELECT * FROM whatsapp_accounts WHERE business_id = $1 LIMIT 1',
            [bizId]
          );
          if (result.rows.length > 0) {
            const acc = result.rows[0];
            return res.status(200).json({
              is_connected: Boolean(acc.is_connected),
              phone_number_id: acc.phone_number_id,
              waba_id: acc.waba_id,
              connection_status: acc.connection_status || 'connected',
            });
          }
        } catch (err) {
          logger.warn('WhatsApp status DB query error:', err.message);
        }
      }

      return res.status(200).json({
        is_connected: false,
        phone_number_id: 'Not Configured',
        waba_id: null,
        connection_status: 'disconnected',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/settings/whatsapp/connect
   */
  static async connectAccount(req, res, next) {
    try {
      const bizId = req.currentBusiness?.id;
      const { phone_number_id, waba_id, access_token, verify_token, app_secret } = req.body;

      if (!phone_number_id || !access_token) {
        return res.status(422).json({ detail: 'phone_number_id and access_token are required' });
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bizId);
      if (isUuid) {
        try {
          const encToken = encrypt(access_token);
          const encSecret = app_secret ? encrypt(app_secret) : null;
          const existing = await query('SELECT id FROM whatsapp_accounts WHERE business_id = $1', [bizId]);
          if (existing.rows.length === 0) {
            await query(
              `INSERT INTO whatsapp_accounts 
               (id, business_id, phone_number_id, waba_id, access_token, verify_token, app_secret, connection_status, is_connected, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'connected', true, NOW(), NOW())`,
              [bizId, phone_number_id, waba_id || null, encToken, verify_token || config.WHATSAPP_VERIFY_TOKEN, encSecret]
            );
          } else {
            await query(
              `UPDATE whatsapp_accounts 
               SET phone_number_id = $1, access_token = $2, app_secret = COALESCE($3, app_secret), is_connected = true, connection_status = 'connected', updated_at = NOW() 
               WHERE business_id = $4`,
              [phone_number_id, encToken, encSecret, bizId]
            );
          }
        } catch (err) {
          logger.warn('WhatsApp connect account DB write failed:', err.message);
        }
      }

      return res.status(200).json({
        status: 'connected',
        phone_number_id,
      });
    } catch (err) {
      next(err);
    }
  }
}
