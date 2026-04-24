/**
 * Cross-session passive memory recall.
 *
 * Runs before the LLM call on each /api/chat request. Embeds the current
 * user message and asks Convex for top-k semantically similar memories
 * across all past conversations (not just the active one).
 *
 * Any failure (missing key, timeout, embedding error) returns an empty
 * array — the chat pipeline must never break because recall stumbled.
 */

import { api } from '@/convex/_generated/api';
import { EdgeConvexClient } from '@/lib/convex';
import { embedText } from '@/lib/llm/embeddings';

export interface CrossSessionMemory {
  id: string;
  category: string;
  content: string;
  importance: number;
  score: number;
}

interface RecallOptions {
  topK: number;
  timeoutMs: number;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

export async function recallCrossSessionMemories(
  convex: EdgeConvexClient,
  userMessage: string,
  { topK, timeoutMs }: RecallOptions
): Promise<CrossSessionMemory[]> {
  const trimmed = userMessage.trim();
  if (!trimmed) return [];

  return withTimeout(
    (async () => {
      const embedding = await embedText(trimmed);
      if (!embedding) return [];

      const results = (await convex.action(api.agent_memories.recallByEmbedding, {
        embedding,
        topK,
      })) as CrossSessionMemory[] | null;

      return results ?? [];
    })(),
    timeoutMs,
    []
  );
}
