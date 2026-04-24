import { describe, it, expect } from 'vitest';
import { formatMemoryContext, estimateTokenCount } from './utils';

describe('formatMemoryContext', () => {
  it('returns null when everything is empty', () => {
    expect(
      formatMemoryContext({ quotes: [], insights: {} }, [])
    ).toBeNull();
  });

  it('returns null when memory is null and no cross-session', () => {
    expect(formatMemoryContext(null, [])).toBeNull();
  });

  it('includes insights and key quotes but omits cross-session block when empty', () => {
    const result = formatMemoryContext(
      {
        quotes: [{ quote: 'I miss my father' }],
        insights: { personality: 'introspective', interests: ['zen'], concerns: ['grief'] },
      },
      []
    );

    expect(result).not.toBeNull();
    expect(result).toContain('Personality: introspective');
    expect(result).toContain('Interests: zen');
    expect(result).toContain('Concerns: grief');
    expect(result).toContain('Key quotes:');
    expect(result).toContain('- I miss my father');
    expect(result).not.toContain('Things from past conversations');
  });

  it('adds the cross-session block when results are provided', () => {
    const result = formatMemoryContext(
      { quotes: [], insights: {} },
      [
        { category: 'life_event', content: 'Father passed last month', importance: 9 },
        { category: 'concern', content: "Uses 'busy' as an excuse to avoid family", importance: 7 },
      ]
    );

    expect(result).not.toBeNull();
    expect(result).toContain('Things from past conversations worth remembering:');
    expect(result).toContain('- [life_event] Father passed last month');
    expect(result).toContain("- [concern] Uses 'busy' as an excuse to avoid family");
  });

  it('truncates cross-session snippets longer than the max length with an ellipsis', () => {
    const longContent = 'a'.repeat(300);
    const result = formatMemoryContext({ quotes: [], insights: {} }, [
      { category: 'life_event', content: longContent, importance: 5 },
    ]);

    expect(result).not.toBeNull();
    const bulletLine = result!.split('\n').find((l) => l.startsWith('- [life_event]'))!;
    expect(bulletLine.endsWith('…')).toBe(true);
    // Header "- [life_event] " is 16 chars, body capped at 200, plus ellipsis.
    expect(bulletLine.length).toBeLessThanOrEqual(16 + 200 + 1);
  });

  it('returns a non-null context when only cross-session memories exist', () => {
    const result = formatMemoryContext(null, [
      { category: 'preference', content: 'prefers short replies', importance: 4 },
    ]);

    expect(result).toContain('Things from past conversations worth remembering:');
    expect(result).toContain('- [preference] prefers short replies');
  });
});

describe('estimateTokenCount', () => {
  it('counts CJK characters one-to-one', () => {
    expect(estimateTokenCount('无相长老')).toBe(4);
  });

  it('counts non-CJK text by 4-char chunks', () => {
    // 12 chars / 4 = 3
    expect(estimateTokenCount('hello world!')).toBe(3);
  });

  it('mixes CJK and ASCII', () => {
    // 2 CJK + ceil(4/4)=1 → 3
    expect(estimateTokenCount('无相 hi!')).toBe(3);
  });
});
