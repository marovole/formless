/**
 * Type-safe wrappers for Convex internal admin functions
 * Eliminates the need for `as any` casts in API routes
 */

import { internal } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { EdgeConvexClient } from '@/lib/convex';

export interface ApiKeyRecord {
  _id: Id<"api_keys">;
  api_key: string;
  model_name?: string;
  provider: string;
}

export interface PromptRecord {
  _id: Id<"prompts">;
  content: string;
  role: string;
  language: string;
}

export interface ApiUsageLogParams {
  apiKeyId: Id<"api_keys">;
  provider: string;
  modelName?: string;
  userId: Id<"users">;
  conversationId: Id<"conversations">;
  tokensUsed: number;
  success: boolean;
  errorMessage?: string;
  responseTimeMs: number;
}

export interface IncrementUsageParams {
  keyId: Id<"api_keys">;
  tokenCount: number;
}

export async function getAvailableApiKey(
  client: EdgeConvexClient,
  provider: string
): Promise<ApiKeyRecord | null> {
  return client.mutation<ApiKeyRecord | null>(
    internal.api_keys.getAvailableInternal,
    { provider }
  );
}

export async function getActivePrompt(
  client: EdgeConvexClient,
  role: string,
  language: string
): Promise<PromptRecord | null> {
  return client.query<PromptRecord | null>(
    internal.prompts.getActiveInternal,
    { role, language }
  );
}

export async function logApiUsage(
  client: EdgeConvexClient,
  params: ApiUsageLogParams
): Promise<void> {
  await client.mutation(internal.api_usage.logInternal, { ...params });
}

export async function incrementApiKeyUsage(
  client: EdgeConvexClient,
  params: IncrementUsageParams
): Promise<void> {
  await client.mutation(internal.api_keys.incrementUsageInternal, { ...params });
}
