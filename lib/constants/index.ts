/**
 * Application Constants
 * Centralized configuration values to avoid magic numbers
 */

/**
 * LLM API default settings
 */
export const LLM_DEFAULTS = {
  TEMPERATURE: 0.7,
  MAX_TOKENS: 2000,
  TITLE_MAX_LENGTH: 50,
} as const;

/**
 * Conversation list and display defaults
 */
export const CONVERSATION_DEFAULTS = {
  LIST_LIMIT: 20,
  PREVIEW_LENGTH: 100,
} as const;

/**
 * API key management defaults
 */
export const API_KEY_DEFAULTS = {
  DAILY_LIMIT: 1000,
  RESET_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;
