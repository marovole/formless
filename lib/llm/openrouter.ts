/**
 * OpenRouter LLM Client
 *
 * @deprecated Use `streamChatCompletionWithProvider('openrouter', ...)` from `./client.ts` instead.
 * This file is kept for backwards compatibility.
 */

import { streamChatCompletionWithProvider } from './client';
import type { ChatMessage, LLMStreamOptions } from './types';

// Re-export types for backwards compatibility
export type { ChatMessage } from './types';

/**
 * @deprecated Use LLMStreamOptions from './types' instead
 */
export type OpenRouterStreamOptions = LLMStreamOptions;

/**
 * Stream chat completion from OpenRouter API
 *
 * @deprecated Use `streamChatCompletionWithProvider('openrouter', ...)` from `./client.ts` instead.
 */
export async function streamChatCompletion(
  apiKey: string,
  options: OpenRouterStreamOptions
): Promise<void> {
  return streamChatCompletionWithProvider('openrouter', apiKey, options);
}
