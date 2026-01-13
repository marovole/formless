/**
 * Unified LLM Client
 * Provides a single implementation for all LLM providers
 */

import type { ChatMessage, LLMStreamOptions, LLMProviderConfig, LLMProvider } from './types';
import { LLM_DEFAULTS } from '@/lib/constants';

/**
 * Provider configurations
 */
const PROVIDER_CONFIGS: Record<LLMProvider, LLMProviderConfig> = {
  chutes: {
    apiUrl: 'https://llm.chutes.ai/v1/chat/completions',
    defaultModel: 'deepseek-ai/DeepSeek-V3.2-TEE',
    providerName: 'chutes',
  },
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'mistralai/devstral-2512:free',
    providerName: 'openrouter',
  },
};

/**
 * Get provider configuration
 */
export function getProviderConfig(provider: LLMProvider): LLMProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

/**
 * Unified streaming chat completion
 * Uses buffered streaming for robust SSE parsing
 */
export async function streamChatCompletionWithProvider(
  provider: LLMProvider,
  apiKey: string,
  options: LLMStreamOptions
): Promise<void> {
  const config = PROVIDER_CONFIGS[provider];
  const {
    messages,
    temperature = LLM_DEFAULTS.TEMPERATURE,
    max_tokens = LLM_DEFAULTS.MAX_TOKENS,
    onChunk,
    onComplete,
    onError,
  } = options;

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.defaultModel,
        messages,
        temperature,
        max_tokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${config.providerName} API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Buffered streaming: accumulate partial chunks
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              if (onChunk) onChunk(content);
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }

    if (onComplete) {
      await onComplete(fullText);
    }
  } catch (error) {
    if (onError) {
      await onError(error as Error);
    }
  }
}

/**
 * Create a provider-specific client
 */
export function createLLMClient(provider: LLMProvider) {
  return {
    streamChatCompletion: (apiKey: string, options: LLMStreamOptions) =>
      streamChatCompletionWithProvider(provider, apiKey, options),
    config: PROVIDER_CONFIGS[provider],
  };
}
