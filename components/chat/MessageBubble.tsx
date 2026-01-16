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
        className={`max-w-[85%] p-4 ${
          isUser
            ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200 shadow-sm'
            : isError
              ? 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-200 shadow-sm'
              : 'bg-gradient-to-br from-white to-stone-50 border-stone-200 shadow-sm'
        }`}
      >
        <p className="whitespace-pre-wrap text-stone-800 leading-relaxed">{message.content}</p>
        {isError && onRetry && (
          <div className="mt-3 pt-3 border-t border-stone-200/50 flex gap-2">
            <Button size="sm" variant="outline" onClick={onRetry} className="text-xs h-7">
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
      {messages.map((msg) => (
        <MessageBubble
          key={`${msg.role}-${msg.content}`}
          message={msg}
          onRetry={msg.error ? onRetry : undefined}
        />
      ))}
    </>
  );
}
