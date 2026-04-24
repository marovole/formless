import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { embedText, EMBEDDING_DIMENSIONS } from './embeddings';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function buildEmbeddingResponse(vector: number[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: [{ embedding: vector }] }),
  } as Response;
}

function buildErrorResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => `error ${status}`,
  } as Response;
}

const dummyVec = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.01);

describe('embedText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEYS = 'rk-test';
    process.env.EMBEDDING_PROVIDER = 'openrouter';
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('returns the embedding vector on successful response', async () => {
    mockFetch.mockResolvedValue(buildEmbeddingResponse(dummyVec));

    const result = await embedText('hello');

    expect(result).toEqual(dummyVec);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer rk-test',
        }),
        body: expect.stringContaining('openai/text-embedding-3-small'),
      })
    );
  });

  it('returns null when no API key is configured', async () => {
    delete process.env.OPENROUTER_API_KEYS;
    delete process.env.OPENROUTER_API_KEY;

    const result = await embedText('hello');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for empty input', async () => {
    const result = await embedText('   ');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retries once on 429 and returns the vector if retry succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(buildErrorResponse(429))
      .mockResolvedValueOnce(buildEmbeddingResponse(dummyVec));

    const result = await embedText('hello');

    expect(result).toEqual(dummyVec);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns null after retry also fails', async () => {
    mockFetch
      .mockResolvedValueOnce(buildErrorResponse(503))
      .mockResolvedValueOnce(buildErrorResponse(503));

    const result = await embedText('hello');

    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns null on non-retryable 401 without retrying', async () => {
    mockFetch.mockResolvedValue(buildErrorResponse(401));

    const result = await embedText('hello');

    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns null when response body has no embedding field', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response);

    const result = await embedText('hello');

    expect(result).toBeNull();
  });

  it('returns null on thrown network error', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await embedText('hello');

    expect(result).toBeNull();
  });

  it('switches to OpenAI endpoint when EMBEDDING_PROVIDER=openai', async () => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-openai';
    mockFetch.mockResolvedValue(buildEmbeddingResponse(dummyVec));

    await embedText('hello');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-openai',
        }),
        body: expect.stringContaining('"model":"text-embedding-3-small"'),
      })
    );
  });
});
