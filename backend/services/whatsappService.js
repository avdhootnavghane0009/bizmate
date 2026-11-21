import crypto from 'crypto';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

export class WhatsAppService {
  /**
   * Verifies the Meta X-Hub-Signature-256 header using the configured Meta App Secret.
   */
  static verifyWebhookSignature(payloadBuffer, signatureHeader, appSecret = null) {
    const secret = appSecret || config.WHATSAPP_APP_SECRET;
    if (!signatureHeader || !secret) {
      // If app secret not configured in local development, allow webhook through
      return true;
    }

    try {
      const expectedHash = signatureHeader.replace('sha256=', '');
      const computedHash = crypto
        .createHmac('sha256', secret)
        .update(payloadBuffer)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(computedHash, 'hex'));
    } catch (err) {
      logger.warn('WhatsApp webhook signature verification failed:', err.message);
      return false;
    }
  }

  /**
   * Send WhatsApp text message using Meta Graph API Cloud API (v21.0).
   * Supports both live Meta credentials and local development simulation.
   */
  static async sendTextMessage(phoneNumberId, accessToken, toPhone, messageBody) {
    const cleanPhone = String(toPhone).replace(/\D/g, '');
    const effectivePhoneId = phoneNumberId || config.WHATSAPP_PHONE_NUMBER_ID;
    const effectiveToken = accessToken || config.WHATSAPP_ACCESS_TOKEN;

    // Local development simulation fallback if credentials are not configured
    if (!effectiveToken || !effectivePhoneId) {
      const simId = `sim_wamid_${crypto.randomBytes(12).toString('hex')}`;
      logger.info(`[WhatsApp Simulation Mode] Message to +${cleanPhone}: "${messageBody}" (Simulated ID: ${simId})`);
      return {
        status: 'simulated',
        to: cleanPhone,
        message_id: simId,
        messages: [{ id: simId }],
      };
    }

    const url = `https://graph.facebook.com/${config.WHATSAPP_API_VERSION}/${effectivePhoneId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: messageBody,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        logger.error('WhatsApp Cloud API send failed:', data);
        return { status: 'failed', error: data };
      }

      const messageId = data?.messages?.[0]?.id;
      logger.info(`WhatsApp message successfully sent via Meta Cloud API. Message ID: ${messageId}`);
      return {
        status: 'sent',
        message_id: messageId,
        ...data,
      };
    } catch (err) {
      logger.error('WhatsApp sendTextMessage network error:', err.message);
      return { status: 'failed', error: err.message };
    }
  }

  /**
   * Download media bytes (e.g., voice note audio, image) from Meta Graph API.
   */
  static async downloadMedia(mediaId, accessToken) {
    const effectiveToken = accessToken || config.WHATSAPP_ACCESS_TOKEN;
    if (!effectiveToken || config.MOCK_MODE_IF_NO_CREDENTIALS && !accessToken) {
      return Buffer.from('MOCK_AUDIO_DATA_VOICE_NOTE');
    }

    try {
      // Step 1: Retrieve media metadata URL from Meta
      const metaUrl = `https://graph.facebook.com/${config.WHATSAPP_API_VERSION}/${mediaId}`;
      const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (!metaRes.ok) {
        logger.warn(`Failed fetching media metadata for media ID: ${mediaId}`);
        return null;
      }

      const meta = await metaRes.json();
      if (!meta.url) return null;

      // Step 2: Download raw binary stream from Meta authorized CDN URL
      const fileRes = await fetch(meta.url, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      if (!fileRes.ok) {
        logger.warn(`Failed downloading binary media stream from Meta CDN URL`);
        return null;
      }

      const arrayBuffer = await fileRes.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      logger.error('WhatsApp downloadMedia error:', err.message);
      return null;
    }
  }
}
