/**
 * SSE Chat Hook
 * Handles Server-Sent Events streaming for chat messages
 */

import { useState, useCallback } from 'react';
import type { Id } from '@/convex/_generated/dataModel';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

interface SSEEventHandlers {
  onMetadata?: (data: { conversationId?: Id<'conversations'> }) => void;
  onChunk?: (content: string, fullContent: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

interface UseSSEChatReturn {
  isStreaming: boolean;
  currentContent: string;
  sendMessage: (
    message: string,
    conversationId: Id<'conversations'> | null,
    locale: string,
    handlers?: SSEEventHandlers
  ) => Promise<string>;
  abortStream: () => void;
}

/**
 * Parse SSE stream from chat API
 */
async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: SSEEventHandlers,
  onContentUpdate: (content: string) => void
): Promise<string> {
  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('event: metadata')) {
        const dataLine = lines[i + 1];
        if (dataLine?.startsWith('data: ')) {
          try {
            const data = JSON.parse(dataLine.slice(6));
            handlers.onMetadata?.(data);
          } catch {
            // Skip invalid JSON
          }
          i++;
        }
      }

      if (line.startsWith('event: chunk')) {
        const dataLine = lines[i + 1];
        if (dataLine?.startsWith('data: ')) {
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (data.content) {
              fullContent += data.content;
              onContentUpdate(fullContent);
              handlers.onChunk?.(data.content, fullContent);
            }
          } catch {
            // Skip invalid JSON
          }
          i++;
        }
      }

      if (line.startsWith('event: complete')) {
        handlers.onComplete?.();
      }

      if (line.startsWith('event: error')) {
        const dataLine = lines[i + 1];
        if (dataLine?.startsWith('data: ')) {
          try {
            const data = JSON.parse(dataLine.slice(6));
            throw new Error(data.error || 'Stream error');
          } catch (e) {
            if (e instanceof Error && e.message !== 'Stream error') {
              throw e;
            }
            throw new Error('Unknown stream error');
          }
        }
      }
    }
  }

  return fullContent;
}

/**
 * Hook for handling SSE chat streaming
 */
export function useSSEChat(): UseSSEChatReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentContent, setCurrentContent] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const abortStream = useCallback(() => {
    abortController?.abort();
    setAbortController(null);
    setIsStreaming(false);
  }, [abortController]);

  const sendMessage = useCallback(async (
    message: string,
    conversationId: Id<'conversations'> | null,
    locale: string,
    handlers: SSEEventHandlers = {}
  ): Promise<string> => {
    const controller = new AbortController();
    setAbortController(controller);
    setIsStreaming(true);
    setCurrentContent('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationId,
          language: locale,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send message`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body from server');

      const fullContent = await parseSSEStream(reader, handlers, setCurrentContent);

      if (!fullContent.trim()) {
        throw new Error('Empty response from assistant');
      }

      return fullContent;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return currentContent;
      }
      handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      setIsStreaming(false);
      setAbortController(null);
    }
  }, [currentContent]);

  return {
    isStreaming,
    currentContent,
    sendMessage,
    abortStream,
  };
}
