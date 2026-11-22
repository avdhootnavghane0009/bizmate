/**
 * Sarvam AI Service — Dedicated Indian Language Speech Engine
 * Powered by Sarvam AI Saaras v4 (Speech-to-Text) and Bulbul (Text-to-Speech).
 * Seamlessly falls back to Gemini if the Sarvam API is unreachable or unconfigured.
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment.js';
import { GeminiService } from './geminiService.js';
import { UsageService } from './usageService.js';
import { logger } from '../utils/logger.js';

let _sarvamClient = null;

async function getSarvamClient() {
  const apiKey = config.SARVAM_API_KEY || process.env.SARVAM_API_KEY;
  if (!apiKey) return null;

  if (!_sarvamClient) {
    try {
      const { SarvamAIClient } = await import('sarvamai');
      _sarvamClient = new SarvamAIClient({ apiKey });
      logger.info('[Sarvam AI] Client initialized successfully with Saaras v4 engine.');
    } catch (err) {
      logger.warn('[Sarvam AI] Failed initializing Sarvam SDK:', err.message);
      return null;
    }
  }
  return _sarvamClient;
}

export class SarvamService {
  /**
   * Transcribe spoken audio (voice notes) using Sarvam AI Saaras v4.
   * Supports Hindi, Hinglish, Marathi, Tamil, Telugu, and all major Indian languages.
   *
   * @param {Buffer|Uint8Array} audioBytes - Audio binary buffer
   * @param {string} mimeType - e.g. 'audio/ogg', 'audio/wav', 'audio/mp3'
   * @param {string} businessId - Business tenant UUID for usage tracking
   */
  static async transcribeVoiceNote(audioBytes, mimeType = 'audio/ogg', businessId = null) {
    const client = await getSarvamClient();

    if (client && audioBytes && audioBytes.length > 0) {
      const tempDir = path.resolve(config.MEDIA_UPLOAD_DIR || 'media');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Saaras supports .ogg, .wav, .mp3, etc.
      const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('mp3') ? 'mp3' : 'ogg';
      const tempFilePath = path.join(tempDir, `stt_${uuidv4()}.${ext}`);

      try {
        fs.writeFileSync(tempFilePath, Buffer.from(audioBytes));

        const startTime = Date.now();
        const response = await client.speechToText.transcribe({
          file: fs.createReadStream(tempFilePath),
          model: 'saaras:v4',
        });
        const durationSec = (Date.now() - startTime) / 1000;

        const transcription = (response.transcript || '').trim();

        if (transcription) {
          logger.info(`[Sarvam AI] Transcribed voice note (${transcription.length} chars) in ${durationSec.toFixed(2)}s`);

          if (businessId) {
            UsageService.recordAiOperation(businessId, {
              operationName: 'transcribe_voice_note',
              model: 'sarvam-saaras-v4',
              promptTokens: Math.max(100, Math.round(audioBytes.length / 100)),
              completionTokens: Math.max(20, Math.round(transcription.length / 4)),
              durationSeconds: durationSec,
              metadata: {
                provider: 'sarvam',
                model: 'saaras:v4',
                request_id: response.request_id,
              },
            }).catch(() => {});
          }

          return {
            transcription,
            request_id: response.request_id,
            provider: 'sarvam',
          };
        }
      } catch (err) {
        logger.warn('[Sarvam AI] Transcription error, falling back to Gemini:', err.message);
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

    // Seamless fallback to Gemini AI voice note transcriber
    logger.info('[Voice Pipeline] Delegating voice note to Gemini transcription fallback.');
    return await GeminiService.transcribeVoiceNote(audioBytes, mimeType, 'general', businessId);
  }
}
