'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionTracking, useGuanzhaoTriggers } from '@/lib/hooks/useSessionTracking';
import { GuanzhaoTriggerContainer } from '@/components/guanzhao/GuanzhaoTriggerCard';
import { MessageList, type ChatMessage } from '@/components/chat/MessageBubble';
import { useSSEChat } from '@/lib/hooks/useSSEChat';
import { useLocale } from 'next-intl';
import { useAuthGuard } from '@/lib/hooks/useAuth';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@clerk/nextjs';
import type { Id } from '@/convex/_generated/dataModel';

export default function ChatPage() {
  // Auth guard - redirect to login if not authenticated
  useAuthGuard();

  const locale = useLocale();
  const { userId } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<Id<'conversations'> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // SSE Chat hook for streaming
  const { isStreaming, currentContent, sendMessage } = useSSEChat();

  // Convex mutations
  const createConversation = useMutation(api.conversations.create);
  const appendMessage = useMutation(api.messages.append);

  // Real-time Convex message query (when conversationId exists)
  const convexMessages = useQuery(
    api.messages.listByConversation,
    conversationId ? { conversationId } : 'skip'
  );

  // Sync Convex messages to local state when updated
  useEffect(() => {
    if (convexMessages && !isStreaming) {
      setMessages(convexMessages.map((m: { role: 'user' | 'assistant'; content: string }) => ({
        role: m.role,
        content: m.content,
      })));
    }
  }, [convexMessages, isStreaming]);

  // Update streaming message in real-time
  useEffect(() => {
    if (isStreaming && currentContent) {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          lastMessage.content = currentContent;
        }
        return newMessages;
      });
    }
  }, [isStreaming, currentContent]);

  // Guanzhao session tracking
  const { isActive: sessionTrackingActive } = useSessionTracking(conversationId as string | null, {
    enabled: true,
    heartbeatInterval: 60000,
    pauseWhenHidden: true,
  });

  // Trigger management
  const {
    pendingTrigger,
    showTrigger,
    dismissTrigger,
  } = useGuanzhaoTriggers();

  // Handle trigger action
  const handleTriggerAction = useCallback(async (action: string, triggerId: string) => {
    try {
      const response = await fetch('/api/guanzhao/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          triggerId,
        }),
      });

      if (response.ok) {
        dismissTrigger();
      }
    } catch (error) {
      console.error('Error handling trigger action:', error);
    }
  }, [dismissTrigger]);

  // Listen for trigger events
  useEffect(() => {
    const handleTriggerEvent = (event: CustomEvent) => {
      const { triggerId } = event.detail;

      // Call trigger engine to get template
      fetch('/api/guanzhao/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerId,
          channel: 'in_app',
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.allowed && data.template) {
            showTrigger(triggerId, data.template);
          }
        })
        .catch(error => {
          console.error('Error fetching trigger template:', error);
        });
    };

    window.addEventListener('guanzhao:trigger', handleTriggerEvent as EventListener);

    return () => {
      window.removeEventListener('guanzhao:trigger', handleTriggerEvent as EventListener);
    };
  }, [showTrigger]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    setErrorMessage(null);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // 1. Create conversation if not exists
      let currentConvId = conversationId;
      if (!currentConvId) {
        currentConvId = await createConversation({
          title: userMessage.slice(0, 30),
          language: locale,
        });
        setConversationId(currentConvId);
      }

      // 2. Save user message to Convex
      await appendMessage({
        conversationId: currentConvId,
        role: 'user',
        content: userMessage,
      });

      // 3. Add placeholder for assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      // 4. Call LLM API with streaming
      const assistantMessage = await sendMessage(
        userMessage,
        currentConvId,
        locale,
        {
          onMetadata: (data) => {
            if (data.conversationId) {
              setConversationId(data.conversationId);
            }
          },
          onError: (error) => {
            console.error('Stream error:', error);
          },
        }
      );

      // 5. Save assistant message to Convex after streaming completes
      if (currentConvId && assistantMessage.trim()) {
        await appendMessage({
          conversationId: currentConvId,
          role: 'assistant',
          content: assistantMessage,
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';

      // Remove the empty assistant message if it exists
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1]?.role === 'assistant' &&
            newMessages[newMessages.length - 1]?.content === '') {
          newMessages.pop();
        }
        return [...newMessages, { role: 'assistant', content: errorMsg, error: true }];
      });

      setErrorMessage(errorMsg);
    }
  };

  const handleRetry = async () => {
    // Retry the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage && !isStreaming) {
      setInput(lastUserMessage.content);
      await handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 flex flex-col relative">
      {/* Trigger container */}
      <GuanzhaoTriggerContainer
        pendingTrigger={pendingTrigger}
        onDismiss={dismissTrigger}
        onAction={handleTriggerAction}
      />

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          <MessageList messages={messages} onRetry={handleRetry} />
          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your message..."
            disabled={isStreaming}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={isStreaming}>
            {isStreaming ? 'Sending...' : 'Send'}
          </Button>
        </div>

        {/* Session tracking status indicator (for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-stone-400 mt-2 text-center">
            {sessionTrackingActive ? 'Session tracking active' : 'Session tracking inactive'}
          </div>
        )}
      </div>
    </div>
  );
}
