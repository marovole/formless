/**
 * MessageBubble Component
 * Renders a chat message bubble with appropriate styling
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
}

/**
 * Renders a single message bubble
 */
export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.error;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <Card
        className={`max-w-[80%] p-4 ${
          isUser
            ? 'bg-amber-50 border-amber-200'
            : isError
              ? 'bg-red-50 border-red-200'
              : 'bg-white border-stone-200'
        }`}
      >
        <p className="whitespace-pre-wrap text-stone-800">{message.content}</p>
        {isError && onRetry && (
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  onRetry?: () => void;
}

/**
 * Renders a list of message bubbles
 */
export function MessageList({ messages, onRetry }: MessageListProps) {
  return (
    <>
      {messages.map((msg, idx) => (
        <MessageBubble
          key={idx}
          message={msg}
          onRetry={msg.error ? onRetry : undefined}
        />
      ))}
    </>
  );
}
