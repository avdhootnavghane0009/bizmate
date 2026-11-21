import { config } from '../config/environment.js';
import { getGeminiModel } from '../config/gemini.js';
import { UsageService } from './usageService.js';
import { logger } from '../utils/logger.js';

/**
 * Retry a Gemini API call up to `maxRetries` times with exponential backoff.
 * Handles 503 Service Unavailable and other transient errors gracefully.
 */
async function withGeminiRetry(fn, maxRetries = 2, baseDelayMs = 1200) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTransient =
        err.message?.includes('503') ||
        err.message?.includes('overloaded') ||
        err.message?.includes('rate') ||
        err.message?.includes('quota') ||
        err.message?.includes('UNAVAILABLE');
      if (isTransient && attempt <= maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`Gemini transient error (attempt ${attempt}/${maxRetries + 1}), retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

export class GeminiService {
  /**
   * Detects language (Hindi, Hinglish, Marathi, etc.) and translates to English.
   */
  static async detectAndTranslate(text, businessId = null) {
    if (!text || typeof text !== 'string') {
      return { detected_language: 'English', english_translation: '', confidence: 1.0 };
    }

    if (!config.GEMINI_API_KEY) {
      const isHindi = ['bhaiya', 'mujhe', 'karna', 'hai', 'kal', 'shaam', 'baje', 'kitna', 'namaste', 'theek', 'paisa']
        .some(w => text.toLowerCase().includes(w));
      const detected = isHindi ? 'Hinglish' : 'English';
      
      if (businessId) {
        UsageService.recordAiOperation(businessId, {
          operationName: 'detect_and_translate',
          model: 'gemini-simulation-fallback',
          promptTokens: Math.max(15, Math.round(text.length / 4)),
          completionTokens: Math.max(10, Math.round(text.length / 4)),
          metadata: { mode: 'simulated' },
        }).catch(() => {});
      }

      return {
        detected_language: detected,
        english_translation: `[English Translation]: ${text}`,
        confidence: 0.95,
      };
    }

    const prompt = `You are a multilingual AI language expert.
Analyze this message: "${text}"
1. Detect exact language (English, Hindi, Hinglish, Marathi, Gujarati, Tamil, etc.).
2. Translate to professional English.
Return JSON: {"detected_language": "...", "english_translation": "...", "confidence": 0.95}`;

    try {
      const model = getGeminiModel(config.GEMINI_MODEL, { responseMimeType: 'application/json' });
      if (model) {
        const startTime = Date.now();
        const result = await withGeminiRetry(() => model.generateContent(prompt));
        const durationSeconds = (Date.now() - startTime) / 1000;
        const parsed = JSON.parse(result.response.text());

        // Meter exact Gemini usage tokens
        if (businessId) {
          const usage = result.response?.usageMetadata;
          UsageService.recordAiOperation(businessId, {
            operationName: 'detect_and_translate',
            model: config.GEMINI_MODEL,
            promptTokens: usage?.promptTokenCount || Math.round(prompt.length / 4),
            completionTokens: usage?.candidatesTokenCount || Math.round(result.response.text().length / 4),
            durationSeconds,
            metadata: { detected_language: parsed.detected_language },
          }).catch(() => {});
        }

        return parsed;
      }
    } catch (err) {
      logger.warn('Gemini detectAndTranslate failed, fallback engaged:', err.message);
    }

    return { detected_language: 'Hinglish', english_translation: text, confidence: 0.85 };
  }

  /**
   * Classifies intent and extracts entities (time, item, handover flag).
   */
  static async extractIntentAndEntities(text, industryId = 'salons', timezone = 'Asia/Kolkata', businessId = null) {
    const lower = (text || '').toLowerCase();
    const handover = ['human', 'manager', 'refund', 'complaint', 'talk to person', 'angry']
      .some(w => lower.includes(w));

    if (!config.GEMINI_API_KEY) {
      if (businessId) {
        UsageService.recordAiOperation(businessId, {
          operationName: 'extract_intent_and_entities',
          model: 'gemini-simulation-fallback',
          promptTokens: Math.max(30, Math.round((text || '').length / 4)),
          completionTokens: 25,
          metadata: { mode: 'simulated', industryId },
        }).catch(() => {});
      }

      return {
        intent: industryId === 'salons' ? 'appointment_booking' : 'table_reservation',
        confidence: 0.94,
        service_or_item: industryId === 'salons' ? 'Haircut' : 'Table for 2',
        requested_date: '2026-11-22',
        requested_time: '18:00',
        party_size_or_quantity: (lower.includes('2') || lower.includes('do')) ? '2' : '1',
        requires_human_handover: handover,
        handover_reason: handover ? 'Customer requested human manager' : null,
      };
    }

    const now = new Date().toLocaleString('en-US', { timeZone: timezone });
    const prompt = `You are an enterprise AI Copilot for ${industryId}. Business time: ${now}.
Message: "${text}"
Classify intent (appointment_booking, table_reservation, food_order, menu_enquiry, complaint, refund_request, greeting).
If customer requests human or complains, set requires_human_handover: true.
Return JSON format:
{
  "intent": "appointment_booking",
  "confidence": 0.95,
  "service_or_item": "...",
  "requested_date": "...",
  "requested_time": "...",
  "party_size_or_quantity": "...",
  "requires_human_handover": ${handover},
  "handover_reason": "..."
}`;

    try {
      const model = getGeminiModel(config.GEMINI_MODEL, { responseMimeType: 'application/json' });
      if (model) {
        const startTime = Date.now();
        const result = await withGeminiRetry(() => model.generateContent(prompt));
        const durationSeconds = (Date.now() - startTime) / 1000;
        const parsed = JSON.parse(result.response.text());

        // Meter exact Gemini usage tokens
        if (businessId) {
          const usage = result.response?.usageMetadata;
          UsageService.recordAiOperation(businessId, {
            operationName: 'extract_intent_and_entities',
            model: config.GEMINI_MODEL,
            promptTokens: usage?.promptTokenCount || Math.round(prompt.length / 4),
            completionTokens: usage?.candidatesTokenCount || Math.round(result.response.text().length / 4),
            durationSeconds,
            metadata: { intent: parsed.intent, industryId },
          }).catch(() => {});
        }

        return parsed;
      }
    } catch (err) {
      logger.warn('Gemini extractIntentAndEntities failed, fallback engaged:', err.message);
    }

    return { intent: 'customer_enquiry', confidence: 0.8, requires_human_handover: handover };
  }

  /**
   * Transcribe audio and extract intent from voice notes.
   */
  static async transcribeVoiceNote(audioBytes, mimeType = 'audio/ogg', industryId = 'salons', businessId = null, durationSeconds = 15) {
    if (!config.GEMINI_API_KEY) {
      if (businessId) {
        UsageService.recordAiOperation(businessId, {
          operationName: 'transcribe_voice_note',
          model: 'gemini-simulation-fallback',
          promptTokens: 400,
          completionTokens: 80,
          durationSeconds,
          metadata: { mode: 'simulated', mimeType },
        }).catch(() => {});
      }

      return {
        transcription: 'Namaste, mujhe kal shaam ko 6 baje haircut appointment book karna hai.',
        detected_language: 'Hinglish',
        english_translation: 'Hello, I want to book a haircut appointment tomorrow evening at 6 PM.',
        intent_data: {
          intent: 'appointment_booking',
          confidence: 0.96,
          service_or_item: 'Haircut',
          requested_date: '2026-11-22',
          requested_time: '18:00',
          requires_human_handover: false,
        },
      };
    }

    try {
      const model = getGeminiModel(config.GEMINI_MODEL, { responseMimeType: 'application/json' });
      if (model) {
        const base64Audio = Buffer.isBuffer(audioBytes) ? audioBytes.toString('base64') : Buffer.from(audioBytes).toString('base64');
        const prompt = 'Transcribe spoken audio, detect language, translate to English, and extract intent. Return JSON.';
        const startTime = Date.now();
        const result = await withGeminiRetry(() => model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
        ]));
        const duration = (Date.now() - startTime) / 1000;
        const parsed = JSON.parse(result.response.text());

        // Meter exact audio tokens
        if (businessId) {
          const usage = result.response?.usageMetadata;
          UsageService.recordAiOperation(businessId, {
            operationName: 'transcribe_voice_note',
            model: config.GEMINI_MODEL,
            promptTokens: usage?.promptTokenCount || 400,
            completionTokens: usage?.candidatesTokenCount || 80,
            durationSeconds: Math.max(durationSeconds, duration),
            metadata: { mimeType },
          }).catch(() => {});
        }

        return parsed;
      }
    } catch (err) {
      logger.warn('Gemini transcribeVoiceNote failed, fallback engaged:', err.message);
    }

    return {
      transcription: '[Audio received]',
      detected_language: 'Hinglish',
      english_translation: 'Audio message received',
      intent_data: { intent: 'unknown', confidence: 0.5, requires_human_handover: false },
    };
  }

  /**
   * Localized natural responses in Hindi / English.
   */
  static generateLocalizedReply(customerName, language, intent, validationStatus = {}) {
    const isHindi = (language || '').toLowerCase().includes('hinglish') || (language || '').toLowerCase().includes('hindi');
    if (intent === 'appointment_booking') {
      const slot = validationStatus.slot || 'tomorrow at 6:00 PM';
      if (isHindi) {
        return `Namaste ${customerName}! Ji haan, ${slot} ka slot available hai. Kya main aapka appointment confirm kar doon?`;
      }
      return `Hello ${customerName}! Yes, we have a slot available for ${slot}. Would you like me to confirm this booking?`;
    } else if (intent === 'complaint' || validationStatus.requires_human_handover) {
      if (isHindi) {
        return `Namaste ${customerName}, humne aapki request note kar li hai. Hamare store manager turant aapse connect karenge.`;
      }
      return `Hello ${customerName}, I have transferred this conversation to our store manager. They will assist you shortly.`;
    }
    return `Hello ${customerName}, thank you for messaging Bizmate! We have noted your request.`;
  }

  /**
   * Parse operations instruction (used by AI Assistant page)
   */
  static async extractOperations(instruction, context = {}, businessId = null) {
    if (!config.GEMINI_API_KEY) {
      if (businessId) {
        UsageService.recordAiOperation(businessId, {
          operationName: 'copilot_parse_instruction',
          model: 'gemini-simulation-fallback',
          promptTokens: 40,
          completionTokens: 30,
          metadata: { mode: 'simulated' },
        }).catch(() => {});
      }

      return {
        action: 'parse_instruction',
        instruction,
        detected_intent: 'create_order',
        parameters: { items: ['Potatoes', 'Paneer'], qty: 2 },
        status: 'parsed',
      };
    }

    const prompt = `Parse this business operational instruction into a structured execution plan:
Instruction: "${instruction}"
Context: ${JSON.stringify(context)}
Return JSON: {"action": "...", "detected_intent": "...", "parameters": {}, "status": "parsed"}`;

    try {
      const model = getGeminiModel(config.GEMINI_MODEL, { responseMimeType: 'application/json' });
      if (model) {
        const startTime = Date.now();
        const result = await withGeminiRetry(() => model.generateContent(prompt));
        const durationSeconds = (Date.now() - startTime) / 1000;
        const parsed = JSON.parse(result.response.text());

        if (businessId) {
          const usage = result.response?.usageMetadata;
          UsageService.recordAiOperation(businessId, {
            operationName: 'copilot_parse_instruction',
            model: config.GEMINI_MODEL,
            promptTokens: usage?.promptTokenCount || Math.round(prompt.length / 4),
            completionTokens: usage?.candidatesTokenCount || Math.round(result.response.text().length / 4),
            durationSeconds,
            metadata: { action: parsed.action },
          }).catch(() => {});
        }

        return parsed;
      }
    } catch (err) {
      logger.warn('Gemini extractOperations failed, fallback engaged:', err.message);
    }

    return { action: 'parse_instruction', instruction, status: 'parsed' };
  }
}
