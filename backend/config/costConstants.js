/**
 * Centralized API Cost & Resource Consumption Constants
 * Source of truth for estimating variable provider costs and AI credit weights.
 */
export const COST_CONSTANTS = {
  // USD to INR conversion reference for internal cost accounting
  USD_TO_INR_RATE: 85.0,

  // Google Gemini API Official Pricing (Pay-as-you-go, Flash-Lite tier)
  GEMINI: {
    // Costs in USD per 1 Million tokens
    INPUT_COST_PER_MILLION: 0.075,
    OUTPUT_COST_PER_MILLION: 0.30,
    AUDIO_COST_PER_MINUTE: 0.002,
    // Per-token calculations
    INPUT_COST_PER_TOKEN: 0.075 / 1000000,
    OUTPUT_COST_PER_TOKEN: 0.30 / 1000000,
    AUDIO_COST_PER_SECOND: 0.002 / 60,
  },

  // Transparent AI Operation Credit Weights
  // Used to calculate tenant allowance consumption
  AI_CREDIT_WEIGHTS: {
    detect_and_translate: 0.5,       // Lightweight language detection & translation
    extract_intent_and_entities: 1.0,// Standard business intent classification
    transcribe_voice_note: 2.0,      // Audio transcription + intent parsing
    copilot_parse_instruction: 1.0,  // Operational AI assistant instruction parsing
    default_ai_operation: 1.0,
  },

  // Meta WhatsApp Cloud API Official Rates (India - INR)
  // Under BYOC, these are tracked for merchant visibility and NOT billed to BizMate COGS
  META_WHATSAPP_INR: {
    SERVICE_CONVERSATION: 0.35, // User-initiated 24-hr window (after 1k free tier)
    UTILITY_MESSAGE: 0.115,     // Business-initiated transactional alert
    MARKETING_MESSAGE: 0.82,    // Promotional broadcast
    AUTH_MESSAGE: 0.115,        // OTP verification
  },

  // Baseline Shared Infrastructure Allocation per Tenant (INR/month)
  INFRA_ALLOCATION_PER_TENANT_INR: {
    free: 2.0,
    starter: 15.0,
    growth: 35.0,
    pro: 75.0,
    enterprise: 200.0,
  },
};

/**
 * Calculates estimated Gemini API cost in USD and INR from token usage
 */
export function calculateGeminiCost(inputTokens = 0, outputTokens = 0, audioSeconds = 0) {
  const usdCost =
    inputTokens * COST_CONSTANTS.GEMINI.INPUT_COST_PER_TOKEN +
    outputTokens * COST_CONSTANTS.GEMINI.OUTPUT_COST_PER_TOKEN +
    audioSeconds * COST_CONSTANTS.GEMINI.AUDIO_COST_PER_SECOND;

  const inrCost = usdCost * COST_CONSTANTS.USD_TO_INR_RATE;

  return {
    usd: parseFloat(usdCost.toFixed(6)),
    inr: parseFloat(inrCost.toFixed(4)),
  };
}
