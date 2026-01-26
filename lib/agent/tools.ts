import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import type { EdgeConvexClient } from '@/lib/convex';

export type ToolName =
  | 'save_user_insight'
  | 'recall_user_context'
  | 'update_user_mood'
  | 'search_books'
  | 'get_meditation_audio'
  | 'web_search';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  name: string;
  content: string;
}

export const memoryTools = [
  {
    type: 'function',
    function: {
      name: 'save_user_insight',
      description: '记录用户的重要信息（困扰、偏好、生活事件）以便日后关怀。仅记录可复用的信息，避免隐私细节。',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['concern', 'preference', 'life_event', 'emotion_pattern'],
          },
          content: { type: 'string' },
          importance: { type: 'number', minimum: 1, maximum: 10 },
        },
        required: ['category', 'content', 'importance'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall_user_context',
      description: '回忆与用户相关的历史信息，用于更自然地关怀或延续话题。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 10 },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_user_mood',
      description: '记录用户当前情绪状态，用于下次更贴近的开场关怀。',
      parameters: {
        type: 'object',
        properties: {
          mood: { type: 'string' },
          trigger: { type: 'string' },
        },
        required: ['mood'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_books',
      description: '搜索心理疗愈/哲学/佛学相关书籍推荐。返回结构化书单，不要编造。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          mood: { type: 'string' },
          topic: { type: 'string' },
          language: { type: 'string', enum: ['zh', 'en'] },
          limit: { type: 'number', minimum: 1, maximum: 5 },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_meditation_audio',
      description: '获取冥想/呼吸练习音频。返回可播放的音频 URL 与标题。',
      parameters: {
        type: 'object',
        properties: {
          mood: { type: 'string' },
          duration: { type: 'number', minimum: 1, maximum: 30 },
          style: { type: 'string', enum: ['breathing', 'body_scan', 'zen'] },
          language: { type: 'string', enum: ['zh', 'en'] },
        },
        required: ['mood'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '搜索网络获取相关信息。返回结构化结果，不要编造来源。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          locale: { type: 'string', enum: ['zh', 'en'] },
          limit: { type: 'number', minimum: 1, maximum: 8 },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
] as const;

function safeParseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function executeToolCall(args: {
  toolCall: ToolCall;
  convex: EdgeConvexClient;
  conversationId?: Id<'conversations'>;
}): Promise<ToolResult> {
  const { toolCall, convex, conversationId } = args;
  const name = toolCall.function.name;
  const parsed = safeParseJson(toolCall.function.arguments) ?? {};

  if (name === 'save_user_insight') {
    const category = String(parsed.category || 'concern');
    const content = String(parsed.content || '');
    const importance = Number(parsed.importance || 5);

    const id = await convex.mutation(api.agent_memories.save, {
      category,
      content,
      importance,
      sourceConversationId: conversationId,
    });

    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name,
      content: JSON.stringify({ ok: true, id }),
    };
  }

  if (name === 'recall_user_context') {
    const query = String(parsed.query || '');
    const limit = parsed.limit === undefined ? undefined : Number(parsed.limit);
    const memories = await convex.query(api.agent_memories.recall, { query, limit });

    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name,
      content: JSON.stringify({ ok: true, memories }),
    };
  }

  if (name === 'update_user_mood') {
    const mood = String(parsed.mood || '');
    const trigger = parsed.trigger === undefined ? undefined : String(parsed.trigger);

    await convex.mutation(api.users.updateProfile, {
      updates: {
        last_mood: mood,
        last_mood_trigger: trigger,
      },
    });

    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name,
      content: JSON.stringify({ ok: true }),
    };
  }

  if (name === 'search_books') {
    const query = String(parsed.query || '');
    const mood = parsed.mood === undefined ? undefined : String(parsed.mood);
    const topic = parsed.topic === undefined ? undefined : String(parsed.topic);
    const language = parsed.language === undefined ? undefined : String(parsed.language);
    const limit = parsed.limit === undefined ? undefined : Number(parsed.limit);
    const result = await convex.query(api.resources.searchBooks, {
      query,
      mood,
      topic,
      language,
      limit,
    });

    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name,
      content: JSON.stringify({ ok: true, items: (result as any)?.items ?? [] }),
    };
  }

  if (name === 'get_meditation_audio') {
    const mood = String(parsed.mood || '');
    const durationMinutes = parsed.duration === undefined ? undefined : Number(parsed.duration);
    const style = parsed.style === undefined ? undefined : String(parsed.style);
    const language = parsed.language === undefined ? undefined : String(parsed.language);

    const audio = await convex.query(api.resources.pickMeditationAudio, {
      mood,
      durationMinutes,
      style,
      language,
    });

    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name,
      content: JSON.stringify({ ok: true, audio }),
    };
  }

  if (name === 'web_search') {
    const query = String(parsed.query || '');
    const locale = parsed.locale === undefined ? undefined : String(parsed.locale);
    const limit = parsed.limit === undefined ? undefined : Number(parsed.limit);
    // MVP: no external search configured yet.
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name,
      content: JSON.stringify({
        ok: false,
        error: 'External search is not configured',
        query,
        locale,
        limit,
      }),
    };
  }

  return {
    tool_call_id: toolCall.id,
    role: 'tool',
    name,
    content: JSON.stringify({ ok: false, error: 'Unknown tool' }),
  };
}
