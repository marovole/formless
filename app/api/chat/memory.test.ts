import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/llm/embeddings', () => ({
  embedText: vi.fn(),
}));

import { embedText } from '@/lib/llm/embeddings';
import { recallCrossSessionMemories } from './memory';

const embedTextMock = embedText as unknown as ReturnType<typeof vi.fn>;

function buildConvexStub(actionImpl: (args: unknown) => Promise<unknown>) {
  return {
    action: vi.fn(actionImpl),
    query: vi.fn(),
    mutation: vi.fn(),
  } as unknown as Parameters<typeof recallCrossSessionMemories>[0];
}

describe('recallCrossSessionMemories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    embedTextMock.mockReset();
  });

  it('returns top-k memories when embedding and recall succeed', async () => {
    embedTextMock.mockResolvedValue([0.1, 0.2, 0.3]);
    const convex = buildConvexStub(async () => [
      { id: 'm1', category: 'life_event', content: 'father passed', importance: 9, score: 0.8 },
    ]);

    const result = await recallCrossSessionMemories(convex, 'dream of finding someone', {
      topK: 3,
      timeoutMs: 500,
    });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('father passed');
    expect(convex.action).toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only input without calling embed', async () => {
    const convex = buildConvexStub(async () => {
      throw new Error('should not be called');
    });

    const result = await recallCrossSessionMemories(convex, '   ', {
      topK: 3,
      timeoutMs: 500,
    });

    expect(result).toEqual([]);
    expect(embedTextMock).not.toHaveBeenCalled();
  });

  it('returns empty array when embedding fails (embedText returns null)', async () => {
    embedTextMock.mockResolvedValue(null);
    const convex = buildConvexStub(async () => {
      throw new Error('should not be called');
    });

    const result = await recallCrossSessionMemories(convex, 'hello', {
      topK: 3,
      timeoutMs: 500,
    });

    expect(result).toEqual([]);
    expect(convex.action).not.toHaveBeenCalled();
  });

  it('returns empty array when convex action throws', async () => {
    embedTextMock.mockResolvedValue([0.1, 0.2, 0.3]);
    const convex = buildConvexStub(async () => {
      throw new Error('convex down');
    });

    const result = await recallCrossSessionMemories(convex, 'hello', {
      topK: 3,
      timeoutMs: 500,
    });

    expect(result).toEqual([]);
  });

  it('falls back to empty array when the whole pipeline exceeds the timeout', async () => {
    embedTextMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([0.1]), 200))
    );
    const convex = buildConvexStub(async () => [
      { id: 'm1', category: 'concern', content: 'late', importance: 5, score: 0.9 },
    ]);

    const result = await recallCrossSessionMemories(convex, 'hello', {
      topK: 3,
      timeoutMs: 20,
    });

    expect(result).toEqual([]);
  });

  it('returns empty array when recall action returns null', async () => {
    embedTextMock.mockResolvedValue([0.1]);
    const convex = buildConvexStub(async () => null);

    const result = await recallCrossSessionMemories(convex, 'hello', {
      topK: 3,
      timeoutMs: 500,
    });

    expect(result).toEqual([]);
  });
});
