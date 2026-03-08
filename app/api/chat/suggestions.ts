/**
 * Chat API suggestion utilities
 * Functions for building contextual suggestions based on user messages
 */

export function tryBuildSuggestions(text: string, language: string) {
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