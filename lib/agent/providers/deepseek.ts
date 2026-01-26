import type { ToolCall } from '@/lib/agent/tools';

type AnthropicTextBlock = { type: 'text'; text: string };
type AnthropicToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
type AnthropicToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string };
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

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

    if (m.role === 'user') {
      messages.push({ role: 'user', content: typeof m.content === 'string' ? m.content : '' });
      continue;
    }

    if (m.role === 'assistant') {
      const toolCalls = Array.isArray(m.tool_calls) ? m.tool_calls : [];

      if (toolCalls.length > 0) {
        const blocks: AnthropicContentBlock[] = [];

        const text = typeof m.content === 'string' ? m.content : '';
        if (text) {
          blocks.push({ type: 'text', text });
        }

        for (const tc of toolCalls) {
          let inputObj: unknown = {};
          const rawArgs = tc?.function?.arguments;
          if (typeof rawArgs === 'string') {
            try {
              inputObj = JSON.parse(rawArgs);
            } catch {
              inputObj = {};
            }
          }

          blocks.push({
            type: 'tool_use',
            id: String(tc?.id ?? ''),
            name: String(tc?.function?.name ?? ''),
            input: inputObj,
          });
        }

        messages.push({ role: 'assistant', content: blocks });
      } else {
        messages.push({ role: 'assistant', content: typeof m.content === 'string' ? m.content : '' });
      }
      continue;
    }

    if (m.role === 'tool') {
      // Anthropic expects tool_result blocks inside a user message.
      const toolResultBlock: AnthropicToolResultBlock = {
        type: 'tool_result',
        tool_use_id: m.tool_call_id,
        content: String(m.content ?? ''),
      };

      const last = messages[messages.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        (last.content as AnthropicContentBlock[]).push(toolResultBlock);
      } else {
        messages.push({ role: 'user', content: [toolResultBlock] });
      }
      continue;
    }
  }

  return { system, messages };
}
