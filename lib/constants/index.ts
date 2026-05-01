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

/**
 * Chat streaming constants
 */
export const CHAT_STREAMING = {
  /** SSE chunk size for streaming response */
  CHUNK_SIZE: 120,
  /** Maximum memory items to include in context */
  MEMORY_LIMIT: 8,
  /** Default language for conversations */
  DEFAULT_LANGUAGE: 'zh',
  /** Cross-session semantic recall: top-k results to inject */
  CROSS_SESSION_TOP_K: 3,
  /** Cross-session semantic recall: hard timeout (ms) — skipped if slower */
  CROSS_SESSION_TIMEOUT_MS: 1200,
  /** Recent messages sent to the LLM context (not necessarily full thread in DB) */
  HISTORY_MESSAGE_LIMIT: 80,
} as const;

/**
 * Convex message list fetch limits — avoids unbounded reads as threads grow.
 */
export const CONVERSATION_MESSAGES = {
  /** Default for chat UI (useQuery without explicit limit) */
  LIST_DEFAULT: 500,
  LIST_MAX: 2000,
  /** Memory extraction LLM input — recent slice only */
  EXTRACTION_MAX: 250,
} as const;

/** Max requests per clerk user per rolling window for POST /api/chat */
export const CHAT_RATE_LIMIT = {
  LIMIT: 60,
  WINDOW_MS: 60_000,
} as const;

/**
 * Agent loop constants
 */
export const AGENT_LOOP = {
  /** Maximum tool execution rounds to prevent infinite loops */
  MAX_TOOL_ROUNDS: 4,
  /** Default DeepSeek model */
  DEFAULT_DEEPSEEK_MODEL: 'deepseek-chat',
  /** Temperature for tool-enabled calls */
  TOOL_TEMPERATURE: 0.2,
} as const;

/**
 * Tool message pattern for client-side tool button encoding
 * Format: __tool:{tool_name}__ {json_args}
 */
export const TOOL_MESSAGE_PATTERN = /^__tool:([a-z_]+)__\s*(\{[\s\S]*\})$/;
