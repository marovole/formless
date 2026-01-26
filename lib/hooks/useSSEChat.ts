/**
 * SSE Chat Hook
 * Handles Server-Sent Events streaming for chat messages
 */

import { useState, useCallback } from 'react';
import type { Id } from '@/convex/_generated/dataModel';

interface SSEEventHandlers {
  onMetadata?: (data: { conversationId?: Id<'conversations'> }) => void;
  onChunk?: (content: string, fullContent: string) => void;
  onSuggestion?: (data: { suggestions: Array<{ tool: string; label: string; params: any }> }) => void;
  onAudio?: (data: { title: string; url: string; duration: number; instructions?: string }) => void;
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
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary === -1) break;

      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const lines = rawEvent.split('\n');
      let eventType: string | undefined;
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice('event:'.length).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trimStart());
        }
      }

      const data = dataLines.join('\n');
      if (!eventType) continue;

      if (eventType === 'metadata') {
        try {
          handlers.onMetadata?.(JSON.parse(data));
        } catch {
          // Ignore invalid metadata payloads.
        }
        continue;
      }

      if (eventType === 'chunk') {
        try {
          const payload = JSON.parse(data) as { content?: string };
          if (payload.content) {
            fullContent += payload.content;
            onContentUpdate(fullContent);
            handlers.onChunk?.(payload.content, fullContent);
          }
        } catch {
          // Ignore invalid chunk payloads.
        }
        continue;
      }

      if (eventType === 'complete') {
        handlers.onComplete?.();
        continue;
      }

      if (eventType === 'suggestion') {
        try {
          handlers.onSuggestion?.(JSON.parse(data));
        } catch {
          // Ignore invalid payload.
        }
        continue;
      }

      if (eventType === 'audio') {
        try {
          handlers.onAudio?.(JSON.parse(data));
        } catch {
          // Ignore invalid payload.
        }
        continue;
      }

      if (eventType === 'error') {
        try {
          const payload = JSON.parse(data) as { error?: string };
          throw new Error(payload.error || 'Stream error');
        } catch (e) {
          if (e instanceof Error && e.message !== 'Stream error') {
            throw e;
          }
          throw new Error('Unknown stream error');
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
      const payload: {
        message: string;
        language: string;
        conversationId?: Id<'conversations'>;
      } = {
        message,
        language: locale,
      };

      if (conversationId) {
        payload.conversationId = conversationId;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
