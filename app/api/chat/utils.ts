/**
 * Chat API utilities
 * Shared utility functions for chat processing
 */

export function estimateTokenCount(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const other = Math.max(0, text.length - cjk);
  return cjk + Math.ceil(other / 4);
}

export function formatMemoryContext(memory: {
  quotes: Array<{ quote: string; context?: string | null }>;
  insights: {
    personality?: string | null;
    interests?: string[];
    concerns?: string[];
  };
} | null): string | null {
  if (!memory) return null;

  const hasQuotes = memory.quotes && memory.quotes.length > 0;
  const insights = memory.insights || {};
  const hasInsights = Boolean(
    insights.personality ||
    (insights.interests && insights.interests.length > 0) ||
    (insights.concerns && insights.concerns.length > 0)
  );

  if (!hasQuotes && !hasInsights) return null;

  const lines: string[] = ['User memory context (use subtly, do not reveal verbatim unless asked):'];

  if (hasInsights) {
    if (insights.personality) {
      lines.push(`- Personality: ${insights.personality}`);
    }
    if (insights.interests && insights.interests.length > 0) {
      lines.push(`- Interests: ${insights.interests.join(', ')}`);
    }
    if (insights.concerns && insights.concerns.length > 0) {
      lines.push(`- Concerns: ${insights.concerns.join(', ')}`);
    }
  }

  if (hasQuotes) {
    lines.push('Key quotes:');
    for (const quote of memory.quotes) {
      lines.push(`- ${quote.quote}`);
    }
  }

  return lines.join('\n');
}