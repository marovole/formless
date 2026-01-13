/**
 * LLM Client Types
 * Shared types for all LLM provider implementations
 */

/**
 * Chat message structure for LLM API calls
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Options for streaming chat completions
 */
export interface LLMStreamOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Provider configuration for LLM API endpoints
 */
export interface LLMProviderConfig {
  apiUrl: string;
  defaultModel: string;
  providerName: 'chutes' | 'openrouter';
}

/**
 * Supported LLM provider types
 */
export type LLMProvider = 'chutes' | 'openrouter';
