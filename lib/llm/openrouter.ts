export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterStreamOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export async function streamChatCompletion(
  apiKey: string,
  options: OpenRouterStreamOptions
): Promise<void> {
  const { messages, onChunk, onComplete, onError } = options;

  try {
    const mockResponse = 'Memory extraction mock response';
    
    if (onChunk) onChunk(mockResponse);
    if (onComplete) onComplete(mockResponse);
  } catch (error) {
    if (onError) onError(error as Error);
  }
}
