import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './environment.js';
import { logger } from '../utils/logger.js';

let genAI = null;

if (config.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    logger.info(`Google Gemini AI initialized with model: ${config.GEMINI_MODEL}`);
  } catch (err) {
    logger.error('Failed to initialize Google Gemini AI:', err.message);
  }
} else {
  logger.info('Gemini API key not configured. Mock/Fallback mode active.');
}

export function getGeminiModel(modelName = config.GEMINI_MODEL, generationConfig = {}) {
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });
}

export { genAI };
