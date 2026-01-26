import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import type { EdgeConvexClient } from '@/lib/convex';

export type ToolName = 'save_user_insight' | 'recall_user_context' | 'update_user_mood';

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

  return {
    tool_call_id: toolCall.id,
    role: 'tool',
    name,
    content: JSON.stringify({ ok: false, error: 'Unknown tool' }),
  };
}
