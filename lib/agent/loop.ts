import type { ChatMessage } from '@/lib/llm/types';
import type { ToolCall, ToolResult } from '@/lib/agent/tools';
import { executeToolCall, memoryTools } from '@/lib/agent/tools';
import type { EdgeConvexClient } from '@/lib/convex';
import type { Id } from '@/convex/_generated/dataModel';

type LLMWithToolsResponse = {
  content: string;
  toolCalls: ToolCall[];
};

function parseToolCalls(raw: any): ToolCall[] {
  const calls = raw?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls as ToolCall[];
}

function parseContent(raw: any): string {
  return (raw?.choices?.[0]?.message?.content as string | undefined) ?? '';
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
      temperature: 0.2,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`openrouter tools error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as any;
  return {
    content: parseContent(data),
    toolCalls: parseToolCalls(data),
  };
}

export async function runMemoryAgentLoop(args: {
  convex: EdgeConvexClient;
  openRouterApiKey: string;
  openRouterModel: string;
  messages: ChatMessage[];
  conversationId: Id<'conversations'>;
  maxToolRounds?: number;
}): Promise<{ finalContent: string; toolResults: ToolResult[] }>{
  const maxToolRounds = Math.min(args.maxToolRounds ?? 2, 4);
  const toolResults: ToolResult[] = [];

  const workingMessages: unknown[] = args.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let round = 0;
  let lastContent = '';

  while (round < maxToolRounds) {
    const { content, toolCalls } = await callOpenRouterWithTools({
      apiKey: args.openRouterApiKey,
      model: args.openRouterModel,
      messages: workingMessages,
    });

    lastContent = content;

    if (!toolCalls.length) {
      return { finalContent: lastContent, toolResults };
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

  return { finalContent: lastContent, toolResults };
}
