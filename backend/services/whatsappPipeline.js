import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { config } from '../config/environment.js';
import { WhatsAppService } from './whatsappService.js';
import { GeminiService } from './geminiService.js';
import { SarvamService } from './sarvamService.js';
import { BusinessValidator } from './businessValidator.js';
import { EntitlementService } from './entitlementService.js';
import { UsageService } from './usageService.js';
import { N8nService } from './n8nService.js';
import { MediaStorageService } from './mediaStorageService.js';
import { decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

export class WhatsAppPipeline {
  /**
   * Complete WhatsApp Webhook Event Processor:
   * 1. Status event handling (sent, delivered, read, failed)
   * 2. Message deduplication (Idempotency)
   * 3. Tenant & Customer Resolution
   * 4. Immediate Raw Message Persistence (Zero Data Loss)
   * 5. Gemini AI Multilingual Processing (Intent, Entities, Translation)
   * 6. Human Handover Escalation
   * 7. Business Availability Validation
   * 8. Localized Natural Auto-Reply via Meta Cloud API
   * 9. n8n Visual Automation Dispatch
   */
  static async processIncomingPayload(payload) {
    try {
      const entry = payload?.entry?.[0] || {};
      const changes = entry?.changes?.[0]?.value || {};
      const metadata = changes?.metadata || {};
      const phoneNumberId = metadata?.phone_number_id;

      // -------------------------------------------------------------
      // A. PROCESS MESSAGE STATUS UPDATES (sent, delivered, read, failed)
      // -------------------------------------------------------------
      const statuses = changes?.statuses || [];
      if (statuses.length > 0) {
        for (const st of statuses) {
          const wamid = st.id;
          const newStatus = st.status; // 'sent' | 'delivered' | 'read' | 'failed'
          try {
            await query(
              'UPDATE messages SET delivery_status = $1 WHERE whatsapp_message_id = $2',
              [newStatus, wamid]
            );
            logger.info(`Updated message ${wamid} status to: ${newStatus}`);
          } catch (err) {
            logger.warn('Failed updating message delivery status:', err.message);
          }
        }
        return { status: 'statuses_updated', count: statuses.length };
      }

      // -------------------------------------------------------------
      // B. PROCESS INCOMING MESSAGES
      // -------------------------------------------------------------
      const messages = changes?.messages || [];
      if (!messages || messages.length === 0) {
        return { status: 'no_messages' };
      }

      const msg = messages[0];
      const wamid = msg.id;
      const rawFromPhone = msg.from;
      const cleanPhone = String(rawFromPhone).replace(/\D/g, '');
      const msgType = msg.type || 'text';

      // 1. Deduplication / Idempotency Check
      try {
        const dupCheck = await query(
          'SELECT id FROM whatsapp_webhook_events WHERE whatsapp_message_id = $1',
          [wamid]
        );
        if (dupCheck.rows.length > 0) {
          logger.info(`Incoming message ${wamid} already processed (idempotent skip).`);
          return { status: 'already_processed', wamid };
        }
      } catch (err) {
        // Continue if event table check is unavailable
      }

      // 2. Identify Business Tenant via Phone Number ID
      let businessId = null;
      let waAccount = null;

      try {
        if (phoneNumberId) {
          const waRes = await query(
            'SELECT * FROM whatsapp_accounts WHERE phone_number_id = $1 LIMIT 1',
            [String(phoneNumberId)]
          );
          if (waRes.rows.length > 0) {
            waAccount = waRes.rows[0];
            if (waAccount.access_token) waAccount.access_token = decrypt(waAccount.access_token);
            if (waAccount.app_secret) waAccount.app_secret = decrypt(waAccount.app_secret);
            businessId = waAccount.business_id;
          }
        }

        // If not found, map to the active business in PostgreSQL
        if (!businessId) {
          const bizRes = await query('SELECT id, industry_id, name FROM businesses WHERE is_active = true LIMIT 1');
          if (bizRes.rows.length > 0) {
            businessId = bizRes.rows[0].id;
          }
        }
      } catch (err) {
        logger.warn('Tenant lookup error in pipeline:', err.message);
      }

      if (!businessId) {
        businessId = '00000000-0000-0000-0000-000000000001';
      }

      // Record webhook event for idempotency
      try {
        await query(
          `INSERT INTO whatsapp_webhook_events (id, business_id, whatsapp_message_id, event_type, payload, processed, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [uuidv4(), businessId, wamid, 'message', JSON.stringify(payload), true]
        );
      } catch (err) {}

      // 3. Customer Identification (Find or Create by normalized phone)
      let customer = null;
      const profileName = changes?.contacts?.[0]?.profile?.name || `WhatsApp User (+${cleanPhone.slice(-4)})`;

      try {
        const custRes = await query(
          'SELECT * FROM customers WHERE business_id = $1 AND (phone = $2 OR phone = $3) LIMIT 1',
          [businessId, cleanPhone, `+${cleanPhone}`]
        );
        if (custRes.rows.length > 0) {
          customer = custRes.rows[0];
        } else {
          const newCustId = uuidv4();
          await query(
            `INSERT INTO customers (id, business_id, name, phone, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [newCustId, businessId, profileName, `+${cleanPhone}`]
          );
          customer = { id: newCustId, business_id: businessId, name: profileName, phone: `+${cleanPhone}` };
        }
      } catch (err) {
        customer = { id: uuidv4(), business_id: businessId, name: profileName, phone: `+${cleanPhone}` };
      }

      // 4. Conversation Thread Resolution (Find or Create)
      let conversation = null;
      try {
        const convRes = await query(
          `SELECT * FROM conversations 
           WHERE business_id = $1 AND customer_id = $2 AND channel = 'whatsapp' 
           LIMIT 1`,
          [businessId, customer.id]
        );
        if (convRes.rows.length > 0) {
          conversation = convRes.rows[0];
        } else {
          const newConvId = uuidv4();
          await query(
            `INSERT INTO conversations (id, business_id, customer_id, channel, status, unread_count, created_at)
             VALUES ($1, $2, $3, 'whatsapp', 'active', 0, NOW())`,
            [newConvId, businessId, customer.id]
          );
          conversation = {
            id: newConvId,
            business_id: businessId,
            customer_id: customer.id,
            channel: 'whatsapp',
            is_locked_by_human: false,
            unread_count: 0,
          };
        }
      } catch (err) {
        conversation = {
          id: uuidv4(),
          business_id: businessId,
          customer_id: customer.id,
          channel: 'whatsapp',
          is_locked_by_human: false,
          unread_count: 0,
        };
      }

      // 5. Extract Content by Message Type
      let originalContent = '';
      let mediaUrl = null;
      let transcription = null;

      if (msgType === 'text') {
        originalContent = msg.text?.body || '';
      } else if (msgType === 'audio' || msgType === 'voice') {
        const audioId = msg.audio?.id || msg.voice?.id;
        const token = waAccount?.access_token || config.WHATSAPP_ACCESS_TOKEN;
        const audioBytes = await WhatsAppService.downloadMedia(audioId, token);

        if (audioBytes && audioBytes.length > 0) {
          try {
            const uploadRes = await MediaStorageService.uploadMedia({
              buffer: audioBytes,
              filename: `${wamid}.ogg`,
              mimeType: 'audio/ogg',
              businessId,
            });
            mediaUrl = uploadRes.mediaUrl;

            // Check if tenant's subscription plan allows voice processing
            const voiceCheck = await EntitlementService.checkQuota(businessId, 'voice_processing');
            if (voiceCheck.allowed) {
              const audioRes = await SarvamService.transcribeVoiceNote(audioBytes, 'audio/ogg', businessId);
              transcription = audioRes.transcription;
              originalContent = `🎙️ [Voice Note]: ${transcription}`;
            } else {
              logger.info(`Tenant ${businessId} on plan without voice processing. Audio preserved without AI transcription.`);
              originalContent = '🎙️ [Voice Note received - Transcription requires Starter plan or higher]';
            }
          } catch (e) {
            originalContent = '🎙️ [Voice Note received]';
          }
        } else {
          originalContent = '🎙️ [Voice Note received]';
        }
      } else if (msgType === 'image') {
        originalContent = msg.image?.caption ? `📷 [Image]: ${msg.image.caption}` : '📷 [Image received]';
      } else if (msgType === 'document') {
        originalContent = msg.document?.filename ? `📄 [Document]: ${msg.document.filename}` : '📄 [Document received]';
      } else if (msgType === 'location') {
        originalContent = `📍 [Location]: (${msg.location?.latitude}, ${msg.location?.longitude})`;
      } else if (msgType === 'interactive') {
        const reply = msg.interactive?.button_reply || msg.interactive?.list_reply;
        originalContent = reply?.title || 'Interactive response';
      } else {
        originalContent = `[${msgType} message received]`;
      }

      // -------------------------------------------------------------
      // 6. IMMEDIATE PERSISTENCE BEFORE AI (Guarantees Zero Message Loss)
      // -------------------------------------------------------------
      const incomingMsgId = uuidv4();
      try {
        await query(
          `INSERT INTO messages 
           (id, business_id, conversation_id, sender_type, content, translated_content, 
            detected_language, media_url, media_type, transcription, whatsapp_message_id, 
            intent, entities, delivery_status, created_at)
           VALUES ($1, $2, $3, 'customer', $4, $4, 'English', $5, $6, $7, $8, NULL, '{}'::jsonb, 'received', NOW())`,
          [
            incomingMsgId,
            businessId,
            conversation.id,
            originalContent,
            mediaUrl,
            msgType,
            transcription,
            wamid,
          ]
        );

        await query(
          `UPDATE conversations 
           SET last_message_content = $1, last_message_at = NOW(), 
               unread_count = COALESCE(unread_count, 0) + 1 
           WHERE id = $2`,
          [originalContent, conversation.id]
        );

        // Record incoming WhatsApp message in usage tracking
        UsageService.recordWhatsAppMessage(businessId, {
          direction: 'inbound',
          category: 'service',
          wamid,
        }).catch(() => {});
      } catch (err) {
        logger.error('Failed saving raw incoming message to PostgreSQL:', err);
      }

      // -------------------------------------------------------------
      // 7. GEMINI AI ENRICHMENT (Safe & Non-blocking, Quota-Governed)
      // -------------------------------------------------------------
      let detectedLanguage = 'English';
      let translatedContent = originalContent;
      let intentData = { intent: 'greeting', confidence: 0.9, requires_human_handover: false };

      const aiQuotaCheck = await EntitlementService.checkQuota(businessId, 'ai_operations');
      if (aiQuotaCheck.allowed) {
        try {
          const transRes = await GeminiService.detectAndTranslate(originalContent, businessId);
          detectedLanguage = transRes.detected_language || 'Hinglish';
          translatedContent = transRes.english_translation || originalContent;

          // Fetch business industry context for AI intent extraction
          let industryId = 'general';
          try {
            const bizInfo = await query('SELECT industry_id FROM businesses WHERE id = $1', [businessId]);
            if (bizInfo.rows.length > 0) industryId = bizInfo.rows[0].industry_id;
          } catch (e) {}

          intentData = await GeminiService.extractIntentAndEntities(originalContent, industryId, 'Asia/Kolkata', businessId);

          // Update message with AI enrichments
          await query(
            `UPDATE messages 
             SET translated_content = $1, detected_language = $2, intent = $3, entities = $4
             WHERE id = $5`,
            [translatedContent, detectedLanguage, intentData.intent || null, JSON.stringify(intentData), incomingMsgId]
          );

          await query(
            `UPDATE conversations 
             SET detected_language = $1, current_intent = $2 
             WHERE id = $3`,
            [detectedLanguage, intentData.intent || null, conversation.id]
          );
        } catch (err) {
          logger.warn('Gemini AI enrichment error (message safely preserved):', err.message);
        }
      } else {
        logger.info(`Tenant ${businessId} has reached AI operations quota (${aiQuotaCheck.current_usage}/${aiQuotaCheck.limit}). Preserving raw message without billable AI enrichment.`);
        intentData = { intent: 'customer_message', confidence: 1.0, requires_human_handover: false, quota_exceeded: true };
      }

      // -------------------------------------------------------------
      // 8. HUMAN HANDOVER GUARD
      // -------------------------------------------------------------
      if (
        intentData.requires_human_handover ||
        ['complaint', 'refund_request'].includes(intentData.intent)
      ) {
        try {
          await query(
            "UPDATE conversations SET is_locked_by_human = true, status = 'human_takeover' WHERE id = $1",
            [conversation.id]
          );
        } catch (err) {}

        N8nService.triggerWorkflow('human_handover', String(businessId), {
          conversation_id: String(conversation.id),
          customer_name: customer.name,
          phone: customer.phone,
          reason: intentData.handover_reason || 'AI human handover triggered',
        }).catch(() => {});

        return { status: 'human_handover_engaged', message_id: incomingMsgId };
      }

      if (conversation.is_locked_by_human) {
        return { status: 'human_handling_active', message_id: incomingMsgId };
      }

      // -------------------------------------------------------------
      // 9. BUSINESS VALIDATION & LOCALIZED AUTO-REPLY
      // -------------------------------------------------------------
      const validationResult = await BusinessValidator.validateAndCheckAvailability(businessId, intentData);

      // Async trigger n8n workflow
      N8nService.triggerWorkflow('incoming_whatsapp_message', String(businessId), {
        intent: intentData,
        customer_phone: customer.phone,
        message: originalContent,
      }).catch(() => {});

      const replyText = GeminiService.generateLocalizedReply(
        customer.name,
        detectedLanguage,
        intentData.intent || 'greeting',
        validationResult
      );

      // Send reply via Meta WhatsApp Cloud API
      const pid = waAccount?.phone_number_id || config.WHATSAPP_PHONE_NUMBER_ID || String(phoneNumberId);
      const token = waAccount?.access_token || config.WHATSAPP_ACCESS_TOKEN || '';

      const sendResult = await WhatsAppService.sendTextMessage(pid, token, customer.phone, replyText);
      const outboundWamid = sendResult?.message_id || sendResult?.messages?.[0]?.id || null;

      // Persist outbound AI reply in PostgreSQL
      try {
        const outboundMsgId = uuidv4();
        await query(
          `INSERT INTO messages 
           (id, business_id, conversation_id, sender_type, content, translated_content, 
            detected_language, whatsapp_message_id, delivery_status, created_at)
           VALUES ($1, $2, $3, 'ai', $4, $4, $5, $6, $7, NOW())`,
          [
            outboundMsgId,
            businessId,
            conversation.id,
            replyText,
            detectedLanguage,
            outboundWamid,
            sendResult?.status === 'sent' ? 'sent' : 'simulated',
          ]
        );

        await query(
          'UPDATE conversations SET last_message_content = $1, last_message_at = NOW() WHERE id = $2',
          [replyText, conversation.id]
        );

        // Record outbound AI reply in usage tracking
        UsageService.recordWhatsAppMessage(businessId, {
          direction: 'outbound',
          category: 'service',
          wamid: outboundWamid,
        }).catch(() => {});
      } catch (err) {
        logger.warn('Failed recording outbound AI message in DB:', err.message);
      }

      return { status: 'replied', reply: replyText, incoming_message_id: incomingMsgId };
    } catch (e) {
      logger.error('Error processing incoming WhatsApp message in pipeline:', e);
      return { status: 'error', error: e.message };
    }
  }
}
