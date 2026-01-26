import type { ToolCall } from '@/lib/agent/tools';

type AnthropicTextBlock = { type: 'text'; text: string };
type AnthropicToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};

type AnthropicTool = {
  name: string;
  description?: string;
  input_schema: unknown;
};

export async function deepSeekMessagesWithTools(args: {
  apiKey: string;
  baseUrl?: string;
  model: string;
  system?: string;
  messages: AnthropicMessage[];
  tools: AnthropicTool[];
}): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const baseUrl = (args.baseUrl ?? 'https://api.deepseek.com/anthropic').replace(/\/$/, '');
  const url = `${baseUrl}/v1/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': args.apiKey,
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 1024,
      system: args.system,
      messages: args.messages,
      tools: args.tools,
      tool_choice: { type: 'auto' },
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`deepseek anthropic error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as any;
  const blocks = (data?.content ?? []) as AnthropicContentBlock[];

  let text = '';
  const toolCalls: ToolCall[] = [];

  for (const b of blocks) {
    if (b.type === 'text') {
      text += b.text;
    }
    if (b.type === 'tool_use') {
      toolCalls.push({
        id: b.id,
        type: 'function',
        function: {
          name: b.name,
          arguments: JSON.stringify(b.input ?? {}),
        },
      });
    }
  }

  return { content: text, toolCalls };
}

export function mapOpenAiToolToAnthropic(tool: any): AnthropicTool {
  return {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  };
}

export function mapOpenAiMessagesToAnthropic(input: unknown[]): { system?: string; messages: AnthropicMessage[] } {
  let system: string | undefined;
  const messages: AnthropicMessage[] = [];

  for (const m of input as any[]) {
    if (m.role === 'system') {
      system = system ? `${system}\n\n${m.content}` : m.content;
      continue;
    }

    if (m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role, content: String(m.content ?? '') });
      continue;
    }

    if (m.role === 'tool') {
      // Anthropic expects tool_result blocks inside a user message.
      const toolResultBlock = {
        type: 'tool_result',
        tool_use_id: m.tool_call_id,
        content: String(m.content ?? ''),
      } as any;

      const last = messages[messages.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        (last.content as any[]).push(toolResultBlock);
      } else {
        messages.push({ role: 'user', content: [toolResultBlock] as any });
      }
      continue;
    }
  }

  return { system, messages };
}
