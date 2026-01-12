/**
 * Chutes LLM Client
 *
 * @deprecated Use `streamChatCompletionWithProvider('chutes', ...)` from `./client.ts` instead.
 * This file is kept for backwards compatibility.
 */

import { streamChatCompletionWithProvider } from './client';
import type { ChatMessage, LLMStreamOptions } from './types';

// Re-export types for backwards compatibility
export type { ChatMessage } from './types';

/**
 * @deprecated Use LLMStreamOptions from './types' instead
 */
export type ChutesStreamOptions = LLMStreamOptions;

/**
 * Stream chat completion from Chutes API
 *
 * @deprecated Use `streamChatCompletionWithProvider('chutes', ...)` from `./client.ts` instead.
 */
export async function streamChatCompletion(
  apiKey: string,
  options: ChutesStreamOptions
): Promise<void> {
  return streamChatCompletionWithProvider('chutes', apiKey, options);
}
