import type { ChatMessage } from '@/lib/llm/types';
import type { ToolCall, ToolResult } from '@/lib/agent/tools';
import { executeToolCall, memoryTools } from '@/lib/agent/tools';
import type { EdgeConvexClient } from '@/lib/convex';
import type { Id } from '@/convex/_generated/dataModel';
import { AGENT_LOOP } from '@/lib/constants';
import {
  deepSeekMessages,
  deepSeekMessagesWithTools,
  mapOpenAiMessagesToAnthropic,
  mapOpenAiToolToAnthropic,
} from '@/lib/agent/providers/deepseek';

type LLMWithToolsResponse = {
  content: string;
  toolCalls: ToolCall[];
};

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: ToolCall[];
    };
  }>;
}

interface OpenAiTool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function parseToolCalls(raw: OpenRouterResponse): ToolCall[] {
  const calls = raw?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls;
}

function parseContent(raw: OpenRouterResponse): string {
  return raw?.choices?.[0]?.message?.content ?? '';
}

async function callOpenRouterWithTools(args: {
  apiKey: string;
  model: string;
  messages: unknown[];
}): Promise<LLMWithToolsResponse> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      tools: memoryTools,
      tool_choice: 'auto',
      temperature: AGENT_LOOP.TOOL_TEMPERATURE,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openrouter tools error ${res.status}: ${text}`);
  }

  const data: OpenRouterResponse = await res.json();
  return {
    content: parseContent(data),
    toolCalls: parseToolCalls(data),
  };
}

async function callOpenRouterNoTools(args: {
  apiKey: string;
  model: string;
  messages: unknown[];
}): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: AGENT_LOOP.TOOL_TEMPERATURE,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openrouter error ${res.status}: ${text}`);
  }

  const data: OpenRouterResponse = await res.json();
  return parseContent(data);
}

async function callDeepSeekWithTools(args: {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: unknown[];
}): Promise<LLMWithToolsResponse> {
  const { system, messages } = mapOpenAiMessagesToAnthropic(args.messages);
  const tools = ([...memoryTools] as OpenAiTool[]).map(mapOpenAiToolToAnthropic);

  return await deepSeekMessagesWithTools({
    apiKey: args.apiKey,
    baseUrl: args.baseUrl,
    model: args.model,
    system,
    messages,
    tools,
  });
}

async function callDeepSeekNoTools(args: {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: unknown[];
}): Promise<string> {
  const { system, messages } = mapOpenAiMessagesToAnthropic(args.messages);
  return await deepSeekMessages({
    apiKey: args.apiKey,
    baseUrl: args.baseUrl,
    model: args.model,
    system,
    messages,
  });
}

export async function runMemoryAgentLoop(args: {
  convex: EdgeConvexClient;
  provider: 'openrouter' | 'deepseek';
  apiKey: string;
  model: string;
  baseUrl?: string;
  messages: ChatMessage[];
  conversationId: Id<'conversations'>;
  maxToolRounds?: number;
}): Promise<{ finalContent: string; toolResults: ToolResult[] }> {
  const maxToolRounds = Math.min(
    args.maxToolRounds ?? AGENT_LOOP.MAX_TOOL_ROUNDS,
    AGENT_LOOP.MAX_TOOL_ROUNDS
  );
  const toolResults: ToolResult[] = [];

  const workingMessages: unknown[] = args.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let round = 0;
  let lastContent = '';

  while (round < maxToolRounds) {
    const { content, toolCalls } =
      args.provider === 'deepseek'
        ? await callDeepSeekWithTools({
            apiKey: args.apiKey,
            baseUrl: args.baseUrl,
            model: args.model,
            messages: workingMessages,
          })
        : await callOpenRouterWithTools({
            apiKey: args.apiKey,
            model: args.model,
            messages: workingMessages,
          });

    lastContent = content;

    if (!toolCalls.length) {
      if (lastContent && lastContent.trim()) {
        return { finalContent: lastContent, toolResults };
      }

      const final =
        args.provider === 'deepseek'
          ? await callDeepSeekNoTools({
              apiKey: args.apiKey,
              baseUrl: args.baseUrl,
              model: args.model,
              messages: workingMessages,
            })
          : await callOpenRouterNoTools({
              apiKey: args.apiKey,
              model: args.model,
              messages: workingMessages,
            });

      return { finalContent: final, toolResults };
    }

    workingMessages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const result = await executeToolCall({
        toolCall,
        convex: args.convex,
        conversationId: args.conversationId,
      });
      toolResults.push(result);

      workingMessages.push({
        role: 'tool',
        tool_call_id: result.tool_call_id,
        name: result.name,
        content: result.content,
      });
    }

    round += 1;
  }

  const final =
    args.provider === 'deepseek'
      ? await callDeepSeekNoTools({
          apiKey: args.apiKey,
          baseUrl: args.baseUrl,
          model: args.model,
          messages: workingMessages,
        })
      : await callOpenRouterNoTools({
          apiKey: args.apiKey,
          model: args.model,
          messages: workingMessages,
        });

  return { finalContent: final || lastContent, toolResults };
}
