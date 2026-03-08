import { ConfigError } from '@/lib/errors';
import { EdgeConvexClient } from '@/lib/convex';
import { getAvailableApiKey, getActivePrompt, ApiKeyRecord, PromptRecord } from '@/lib/convex/adminInternal';

interface Logger {
  error: (message: string, context?: Record<string, unknown>) => void;
}

export async function getApiKey(
  { convexAdmin, logger }: { convexAdmin: EdgeConvexClient; logger: Logger },
  clerkId: string,
  conversationId: string
): Promise<ApiKeyRecord> {
  const apiKey = await getAvailableApiKey(convexAdmin, 'openrouter');
  if (!apiKey) {
    logger.error('No available API key', {
      provider: 'openrouter',
      userId: clerkId,
      conversationId,
    });
    throw new ConfigError('OpenRouter API key is not configured');
  }
  return apiKey;
}

export async function getSystemPrompt(
  { convexAdmin }: { convexAdmin: EdgeConvexClient },
  language: string
): Promise<PromptRecord> {
  const systemPrompt = await getActivePrompt(convexAdmin, 'formless_elder', language);
  if (!systemPrompt) {
    throw new ConfigError('Configuration error');
  }
  return systemPrompt;
}
