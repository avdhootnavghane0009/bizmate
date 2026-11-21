import path from 'path';
import fs from 'fs';
import { query } from '../config/database.js';
import { WhatsAppService } from '../services/whatsappService.js';
import { WhatsAppPipeline } from '../services/whatsappPipeline.js';
import { UsageService } from '../services/usageService.js';
import { decrypt } from '../utils/encryption.js';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

export class InboxController {
  /**
   * GET /api/v1/inbox/conversations
   * Scoped strictly to the active business tenant. Returns empty array if no conversations exist.
   */
  static async getConversations(req, res, next) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res.status(400).json({ detail: 'Missing business tenant context' });
      }

      const sql = `
        SELECT c.id, c.customer_id, cust.name, cust.phone, 
               c.last_message_content, c.last_message_at, c.unread_count, 
               c.is_locked_by_human, c.detected_language, c.current_intent
        FROM conversations c
        JOIN customers cust ON c.customer_id = cust.id
        WHERE c.business_id = $1
        ORDER BY c.last_message_at DESC NULLS LAST
      `;
      const results = await query(sql, [businessId]);

      return res.status(200).json(
        results.rows.map((row) => ({
          id: String(row.id),
          customer_id: String(row.customer_id),
          name: row.name,
          phone: row.phone,
          lastMessage: row.last_message_content || 'No messages yet',
          time: row.last_message_at
            ? new Date(row.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Now',
          unread: row.unread_count || 0,
          isLocked: Boolean(row.is_locked_by_human),
          language: row.detected_language || 'Hinglish',
          intent: row.current_intent || 'Enquiry',
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/inbox/conversations/:conversationId/messages
   */
  static async getMessages(req, res, next) {
    try {
      const businessId = req.businessId;
      const { conversationId } = req.params;

      const sql = `
        SELECT id, sender_type, content, translated_content, detected_language, 
               media_url, media_type, transcription, intent, delivery_status, created_at
        FROM messages
        WHERE conversation_id = $1 AND business_id = $2
        ORDER BY created_at ASC
      `;
      const result = await query(sql, [conversationId, businessId]);

      return res.status(200).json(
        result.rows.map((r) => ({
          id: String(r.id),
          sender: r.sender_type,
          content: r.content,
          translated: r.translated_content,
          language: r.detected_language,
          time: r.created_at
            ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
          media_url: r.media_url,
          media_type: r.media_type,
          transcription: r.transcription,
          intent: r.intent,
          delivery_status: r.delivery_status || 'sent',
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/inbox/send
   */
  static async sendMessage(req, res, next) {
    try {
      const businessId = req.businessId;
      const { conversation_id, content } = req.body;

      if (!conversation_id || !content) {
        return res.status(422).json({ detail: 'conversation_id and content are required' });
      }

      // Verify conversation belongs to tenant
      const convCheck = await query(
        'SELECT c.*, cust.phone FROM conversations c JOIN customers cust ON c.customer_id = cust.id WHERE c.id = $1 AND c.business_id = $2',
        [conversation_id, businessId]
      );
      if (convCheck.rows.length === 0) {
        return res.status(404).json({ detail: 'Conversation not found or access denied' });
      }

      const conv = convCheck.rows[0];

      // Retrieve tenant WhatsApp credentials
      let phoneId = config.WHATSAPP_PHONE_NUMBER_ID;
      let accessToken = config.WHATSAPP_ACCESS_TOKEN;

      try {
        const waRes = await query(
          'SELECT phone_number_id, access_token FROM whatsapp_accounts WHERE business_id = $1 LIMIT 1',
          [businessId]
        );
        if (waRes.rows.length > 0 && waRes.rows[0].access_token) {
          phoneId = waRes.rows[0].phone_number_id;
          accessToken = decrypt(waRes.rows[0].access_token);
        }
      } catch (e) {}

      // Dispatch to Meta WhatsApp Cloud API
      const sendRes = await WhatsAppService.sendTextMessage(
        phoneId,
        accessToken,
        conv.phone,
        content
      );
      const outboundWamid = sendRes?.message_id || sendRes?.messages?.[0]?.id || null;
      const initialDeliveryStatus = sendRes?.status === 'sent' ? 'sent' : 'simulated';

      // Insert message into database with WhatsApp Message ID
      const insertSql = `
        INSERT INTO messages (id, business_id, conversation_id, sender_type, content, whatsapp_message_id, delivery_status, created_at)
        VALUES (gen_random_uuid(), $1, $2, 'human', $3, $4, $5, NOW())
        RETURNING *
      `;
      const msgResult = await query(insertSql, [businessId, conversation_id, content, outboundWamid, initialDeliveryStatus]);
      const savedMsg = msgResult.rows[0];

      // Update conversation
      await query(
        'UPDATE conversations SET last_message_content = $1, last_message_at = NOW() WHERE id = $2',
        [content, conversation_id]
      );

      // Record outbound WhatsApp message in usage tracking
      UsageService.recordWhatsAppMessage(businessId, {
        direction: 'outbound',
        category: 'service',
        wamid: outboundWamid,
      }).catch(() => {});

      return res.status(200).json({
        id: String(savedMsg.id),
        sender: 'human',
        content: savedMsg.content,
        whatsapp_message_id: outboundWamid,
        delivery_status: initialDeliveryStatus,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/inbox/simulate-message
   * Simulation webhook pipeline for WhatsApp testing
   */
  static async simulateMessage(req, res, next) {
    try {
      const { phone, text, msg_type = 'text' } = req.body;
      const result = await WhatsAppPipeline.processIncomingPayload({
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: phone,
                text: { body: text },
                type: msg_type,
                id: `wamid.test.${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
              }],
            },
          }],
        }],
      });
      return res.status(200).json(result || { status: 'replied' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/inbox/conversations/:conversationId/lock
   */
  static async toggleLock(req, res, next) {
    try {
      const businessId = req.businessId;
      const { conversationId } = req.params;
      const { is_locked } = req.body;

      const result = await query(
        'UPDATE conversations SET is_locked_by_human = $1 WHERE id = $2 AND business_id = $3 RETURNING *',
        [Boolean(is_locked), conversationId, businessId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ detail: 'Conversation not found or access denied' });
      }

      return res.status(200).json({
        conversation_id: conversationId,
        is_locked_by_human: Boolean(is_locked),
        status: is_locked ? 'locked' : 'unlocked',
      });
    } catch (err) {
      next(err);
    }
  }
}
