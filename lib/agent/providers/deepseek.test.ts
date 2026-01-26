import { describe, it, expect } from 'vitest';
import { mapOpenAiMessagesToAnthropic } from './deepseek';

describe('mapOpenAiMessagesToAnthropic', () => {
  it('maps assistant tool_calls to tool_use and tool messages to tool_result', () => {
    const input = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'save_user_insight', arguments: '{"a":1}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_1',
        name: 'save_user_insight',
        content: '{"ok":true}',
      },
    ];

    const { system, messages } = mapOpenAiMessagesToAnthropic(input);

    expect(system).toBe('sys');
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: 'user', content: 'hi' });

    expect(messages[1].role).toBe('assistant');
    expect(Array.isArray(messages[1].content)).toBe(true);
    expect(messages[1].content).toEqual([
      { type: 'tool_use', id: 'call_1', name: 'save_user_insight', input: { a: 1 } },
    ]);

    expect(messages[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'call_1', content: '{"ok":true}' }],
    });
  });

  it('keeps text before tool_use blocks when assistant has both', () => {
    const input = [
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: 'thinking',
        tool_calls: [
          {
            id: 'call_2',
            type: 'function',
            function: { name: 'recall_user_context', arguments: '{"q":"x"}' },
          },
        ],
      },
    ];

    const { messages } = mapOpenAiMessagesToAnthropic(input);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'thinking' },
        { type: 'tool_use', id: 'call_2', name: 'recall_user_context', input: { q: 'x' } },
      ],
    });
  });
});
