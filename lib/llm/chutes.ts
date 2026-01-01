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

export async function streamChatCompletion(
  apiKey: string,
  options: ChutesStreamOptions
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { messages: _messages, onChunk, onComplete, onError } = options;

  try {
    const mockResponse = '这是一个模拟回复。真实的 LLM API 集成正在开发中...';
    
    for (let i = 0; i < mockResponse.length; i++) {
      if (onChunk) {
        onChunk(mockResponse[i]);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    if (onComplete) onComplete(mockResponse);
  } catch (error) {
    if (onError) onError(error as Error);
  }
}
