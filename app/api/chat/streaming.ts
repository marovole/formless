import { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { streamChatCompletionWithProvider } from '@/lib/llm/client';
import { LLM_DEFAULTS, CHAT_STREAMING, AGENT_LOOP } from '@/lib/constants';
import type { ChatMessage } from '@/lib/llm/types';
import { runMemoryAgentLoop } from '@/lib/agent/loop';
import { EdgeConvexClient } from '@/lib/convex';
import { logApiUsage, incrementApiKeyUsage, ApiKeyRecord } from '@/lib/convex/adminInternal';
import { estimateTokenCount } from './utils';

interface Logger {
  info: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

interface SSEStream {
  sendEvent: (data: string, event?: string) => void;
  sendError: (message: string) => void;
}

interface StreamingParams {
  convex: EdgeConvexClient;
  convexAdmin: EdgeConvexClient;
  logger: Logger;
  stream: SSEStream;
  activeConversationId: Id<'conversations'>;
  convexUserId: Id<'users'>;
  messages: ChatMessage[];
  apiKey: ApiKeyRecord;
  requestStartTime: number;
}

/**
 * 流式发送响应内容
 * 将长文本分块发送以优化前端渲染性能
 */
function streamContentInChunks(
  stream: SSEStream,
  content: string,
  chunkSize: number = CHAT_STREAMING.CHUNK_SIZE
): void {
  for (let i = 0; i < content.length; i += chunkSize) {
    const piece = content.slice(i, i + chunkSize);
    stream.sendEvent(JSON.stringify({ content: piece }), 'chunk');
  }
}

/**
 * 尝试从响应中提取音频元数据
 */
function tryExtractAudioMetadata(content: string): unknown | null {
  const maybeAudio = content.match(/\[AUDIO\]\s*(\{[\s\S]*\})/);
  if (!maybeAudio) return null;

  try {
    return JSON.parse(maybeAudio[1]);
  } catch {
    return null;
  }
}

export async function handleStreamingResponse({
  convex,
  convexAdmin,
  logger,
  stream,
  activeConversationId,
  convexUserId,
  messages,
  apiKey,
  requestStartTime,
}: StreamingParams) {
  let fullResponse = '';

  stream.sendEvent(
    JSON.stringify({ conversationId: activeConversationId }),
    'metadata'
  );

  const enableAgentMemory = process.env.AGENT_MEMORY === 'true';
  const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
  const deepSeekBaseUrl = process.env.DEEPSEEK_ANTHROPIC_BASE_URL;
  const deepSeekModel = process.env.DEEPSEEK_MODEL || AGENT_LOOP.DEFAULT_DEEPSEEK_MODEL;

  if (enableAgentMemory) {
    try {
      const provider = deepSeekApiKey ? 'deepseek' : 'openrouter';
      const apiKeyForProvider = deepSeekApiKey || apiKey.api_key;
      const modelForProvider = deepSeekApiKey
        ? deepSeekModel
        : (apiKey.model_name || 'anthropic/claude-3.7-sonnet');

      logger.info('Agent memory provider selected', {
        conversationId: activeConversationId,
        provider,
        model: modelForProvider,
        hasDeepSeekApiKey: Boolean(deepSeekApiKey),
        deepSeekBaseUrlSet: Boolean(deepSeekBaseUrl),
      });

      const { finalContent } = await runMemoryAgentLoop({
        convex,
        provider,
        apiKey: apiKeyForProvider,
        model: modelForProvider,
        baseUrl: deepSeekBaseUrl,
        messages,
        conversationId: activeConversationId,
      });

      if (!finalContent || !finalContent.trim()) {
        throw new Error('Empty response from memory agent loop');
      }

      const audioPayload = tryExtractAudioMetadata(finalContent);
      if (audioPayload) {
        stream.sendEvent(JSON.stringify(audioPayload), 'audio');
      }

      fullResponse = finalContent;
      streamContentInChunks(stream, finalContent);

      await saveResponseAndLogUsage({
        convex,
        convexAdmin,
        activeConversationId,
        convexUserId,
        apiKey,
        fullResponse,
        requestStartTime,
        success: true,
      });

      stream.sendEvent(JSON.stringify({ done: true }), 'complete');
      return;
    } catch (error) {
      logger.error('Agent memory loop error, falling back to streaming', { error: String(error) });
    }
  }

  await streamChatCompletionWithProvider('openrouter', apiKey.api_key, {
    messages,
    temperature: LLM_DEFAULTS.TEMPERATURE,
    max_tokens: LLM_DEFAULTS.MAX_TOKENS,
    onChunk: (chunk: string) => {
      fullResponse += chunk;
      stream.sendEvent(JSON.stringify({ content: chunk }), 'chunk');
    },
    onComplete: async (fullText: string) => {
      await saveResponseAndLogUsage({
        convex,
        convexAdmin,
        activeConversationId,
        convexUserId,
        apiKey,
        fullResponse: fullText,
        requestStartTime,
        success: true,
      });
      stream.sendEvent(JSON.stringify({ done: true }), 'complete');
    },
    onError: async (error: Error) => {
      logger.error('Chat streaming error', { error: error.message, userId: convexUserId });
      try {
        await logApiUsage(convexAdmin, {
          apiKeyId: apiKey._id,
          provider: 'openrouter',
          modelName: apiKey.model_name,
          userId: convexUserId,
          conversationId: activeConversationId,
          tokensUsed: estimateTokenCount(fullResponse),
          success: false,
          errorMessage: error.message,
          responseTimeMs: Date.now() - requestStartTime,
        });
      } catch (logError) {
        logger.error('Failed to log API usage after streaming error', { logError: String(logError) });
      }
      stream.sendError(error.message);
    },
  });
}

interface SaveResponseParams {
  convex: EdgeConvexClient;
  convexAdmin: EdgeConvexClient;
  activeConversationId: Id<'conversations'>;
  convexUserId: Id<'users'>;
  apiKey: ApiKeyRecord;
  fullResponse: string;
  requestStartTime: number;
  success: boolean;
}

async function saveResponseAndLogUsage({
  convex,
  convexAdmin,
  activeConversationId,
  convexUserId,
  apiKey,
  fullResponse,
  requestStartTime,
  success,
}: SaveResponseParams) {
  const tokenCount = estimateTokenCount(fullResponse);

  await convex.mutation(api.messages.append, {
    conversationId: activeConversationId,
    role: 'assistant',
    content: fullResponse,
    tokens: tokenCount,
  });

  await logApiUsage(convexAdmin, {
    apiKeyId: apiKey._id,
    provider: 'openrouter',
    modelName: apiKey.model_name,
    userId: convexUserId,
    conversationId: activeConversationId,
    tokensUsed: tokenCount,
    success,
    responseTimeMs: Date.now() - requestStartTime,
  });

  await incrementApiKeyUsage(convexAdmin, {
    keyId: apiKey._id,
    tokenCount,
  });
}
