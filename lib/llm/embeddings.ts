/**
 * Embedding client for semantic memory recall.
 *
 * Default provider: OpenRouter `/api/v1/embeddings` proxying
 * `openai/text-embedding-3-small` (1536 dims).
 *
 * Fallback: direct OpenAI when EMBEDDING_PROVIDER=openai.
 *
 * Design rule: any failure returns null. The caller must tolerate a null
 * result — an embedding miss should never take down the chat pipeline.
 */

export const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

type Provider = 'openrouter' | 'openai';

interface ProviderConfig {
  url: string;
  model: string;
  apiKey: string | null;
}

function pickOpenRouterKey(): string | null {
  const raw = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY;
  if (!raw) return null;
  const keys = raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length === 0) return null;
  // Simple round-robin by timestamp; full rotation lives in admin api_keys table.
  return keys[Math.floor(Date.now() / 1000) % keys.length];
}

function resolveProvider(): ProviderConfig {
  const pref = (process.env.EMBEDDING_PROVIDER || 'openrouter') as Provider;

  if (pref === 'openai') {
    return {
      url: 'https://api.openai.com/v1/embeddings',
      model: 'text-embedding-3-small',
      apiKey: process.env.OPENAI_API_KEY || null,
    };
  }

  return {
    url: 'https://openrouter.ai/api/v1/embeddings',
    model: EMBEDDING_MODEL,
    apiKey: pickOpenRouterKey(),
  };
}

async function callOnce(input: string, cfg: ProviderConfig): Promise<number[] | null> {
  if (!cfg.apiKey) return null;

  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      input,
    }),
  });

  if (!response.ok) {
    // 429/503 → let the outer retry decide; others surface immediately.
    if (response.status === 429 || response.status === 503) {
      throw new Error(`retryable: ${response.status}`);
    }
    return null;
  }

  const json = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vector = json.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) return null;
  return vector;
}

/**
 * Generate a single embedding vector. Returns null on any failure.
 *
 * The caller should treat null as "no embedding available, skip semantic
 * recall" — not as an error to surface to the user.
 */
export async function embedText(input: string): Promise<number[] | null> {
  const text = input.trim();
  if (!text) return null;

  const cfg = resolveProvider();
  if (!cfg.apiKey) return null;

  try {
    return await callOnce(text, cfg);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith('retryable')) return null;
    // One retry after a 250ms delay for transient rate-limit / overload.
    await new Promise((r) => setTimeout(r, 250));
    try {
      return await callOnce(text, cfg);
    } catch {
      return null;
    }
  }
}
