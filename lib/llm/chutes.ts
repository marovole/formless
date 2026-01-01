export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChutesStreamOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

const CHUTES_API_URL = 'https://llm.chutes.ai/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V3.2-TEE';

export async function streamChatCompletion(
  apiKey: string,
  options: ChutesStreamOptions
): Promise<void> {
  const { messages, temperature = 0.7, max_tokens = 2000, onChunk, onComplete, onError } = options;

  try {
    const response = await fetch(CHUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature,
        max_tokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chutes API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            if (onComplete) onComplete(fullText);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              if (onChunk) onChunk(content);
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }

    if (onComplete) onComplete(fullText);
  } catch (error) {
    if (onError) onError(error as Error);
  }
}
