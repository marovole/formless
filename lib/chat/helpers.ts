import type { ChatMessage } from '@/lib/llm/types';

export interface MemorySnapshot {
  quotes: Array<{ quote: string; context?: string | null }>;
  insights: {
    personality?: string | null;
    interests?: string[];
    concerns?: string[];
  };
}

export interface ToolSuggestion {
  tool: string;
  label: string;
  params: Record<string, unknown>;
}

export function tryBuildSuggestions(text: string, language: string): { suggestions: ToolSuggestion[] } | null {
  const lower = text.toLowerCase();
  const isSleep = /睡不着|失眠|睡眠/.test(text) || lower.includes('insomnia');
  const isAnxious = /焦虑|紧张|压力/.test(text) || lower.includes('anxious') || lower.includes('anxiety');
  
  if (!isSleep && !isAnxious) return null;

  if (language === 'en') {
    return {
      suggestions: [
        {
          tool: 'get_meditation_audio',
          label: 'Play a 5-min breathing practice',
          params: { mood: isSleep ? 'insomnia' : 'anxiety', duration: 5, style: 'breathing', language: 'en' },
        },
        {
          tool: 'search_books',
          label: 'Recommend a book for this',
          params: { query: isSleep ? 'sleep' : 'anxiety', language: 'en', limit: 3 },
        },
      ],
    };
  }

  return {
    suggestions: [
      {
        tool: 'get_meditation_audio',
        label: '放一段 5 分钟呼吸练习',
        params: { mood: isSleep ? '失眠' : '焦虑', duration: 5, style: 'breathing', language: 'zh' },
      },
      {
        tool: 'search_books',
        label: '推荐一本相关的书',
        params: { query: isSleep ? '睡眠' : '焦虑', language: 'zh', limit: 3 },
      },
    ],
  };
}

export function estimateTokenCount(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const other = Math.max(0, text.length - cjk);
  return cjk + Math.ceil(other / 4);
}

export function formatMemoryContext(memory: MemorySnapshot | null): string | null {
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

export function parseToolMessage(message: string): string {
  const toolMatch = message.match(/^__tool:([a-z_]+)__\s*(\{[\s\S]*\})$/);
  if (!toolMatch) return message;

  try {
    const toolName = toolMatch[1];
    const toolArgs = JSON.parse(toolMatch[2]);
    return `User confirmed tool action. Call tool "${toolName}" with args: ${JSON.stringify(toolArgs)}.`;
  } catch {
    return message;
  }
}

export function buildChatMessages(
  systemPrompt: string,
  memoryContext: string | null,
  conversationHistory: Array<{ role: string; content: string }>,
  userMessage: string
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (memoryContext) {
    messages.push({ role: 'system', content: memoryContext });
  }

  for (const m of conversationHistory) {
    messages.push({
      role: m.role as ChatMessage['role'],
      content: m.content,
    });
  }

  messages.push({ role: 'user', content: userMessage });

  return messages;
}

export function extractAudioPayload(content: string): Record<string, unknown> | null {
  const match = content.match(/\[AUDIO\]\s*(\{[\s\S]*\})/);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}
