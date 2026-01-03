'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useSessionTracking, useGuanzhaoTriggers } from '@/lib/hooks/useSessionTracking';
import { GuanzhaoTriggerContainer } from '@/components/guanzhao/GuanzhaoTriggerCard';
import { useLocale } from 'next-intl';
import { useAuthGuard } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

export default function ChatPage() {
  // Auth guard - redirect to login if not authenticated
  useAuthGuard();

  const locale = useLocale();
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, [supabase]);

  // 观照会话追踪
  const { isActive: sessionTrackingActive } = useSessionTracking(conversationId, {
    enabled: true,
    heartbeatInterval: 60000,
    pauseWhenHidden: true,
  });

  // 触发器管理
  const {
    pendingTrigger,
    showTrigger,
    dismissTrigger,
  } = useGuanzhaoTriggers();

  // 处理触发器动作
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

  // 监听触发事件
  useEffect(() => {
    const handleTriggerEvent = (event: CustomEvent) => {
      const { triggerId } = event.detail;

      // 调用触发引擎获取模板
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
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setErrorMessage(null);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
          language: locale,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send message`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body from server');

      const decoder = new TextDecoder();
      let assistantMessage = '';
      let isComplete = false;

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
                if (data.conversationId) {
                  setConversationId(data.conversationId);
                }
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
                  assistantMessage += data.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    if (newMessages[newMessages.length - 1]) {
                      newMessages[newMessages.length - 1].content = assistantMessage;
                    }
                    return newMessages;
                  });
                }
              } catch {
                // Skip invalid JSON
              }
              i++;
            }
          }

          if (line.startsWith('event: complete')) {
            isComplete = true;
          }

          if (line.startsWith('event: error')) {
            const dataLine = lines[i + 1];
            if (dataLine?.startsWith('data: ')) {
              try {
                const data = JSON.parse(dataLine.slice(6));
                throw new Error(data.error || 'Stream error');
              } catch {
                throw new Error('Unknown stream error');
              }
            }
          }
        }
      }

      if (!assistantMessage.trim()) {
        throw new Error('Empty response from assistant');
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    // Retry the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage && !isLoading) {
      setInput(lastUserMessage.content);
      await handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 flex flex-col relative">
      {/* 触发器容器 */}
      <GuanzhaoTriggerContainer
        pendingTrigger={pendingTrigger}
        onDismiss={dismissTrigger}
        onAction={handleTriggerAction}
      />

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                className={`max-w-[80%] p-4 ${
                  msg.role === 'user'
                    ? 'bg-amber-50 border-amber-200'
                    : msg.error
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-stone-200'
                }`}
              >
                <p className="whitespace-pre-wrap text-stone-800">{msg.content}</p>
                {msg.error && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleRetry}>
                      Retry
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 错误提示 */}
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
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </div>

        {/* 会话追踪状态指示器（可选，用于调试） */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-stone-400 mt-2 text-center">
            {sessionTrackingActive ? '🟢 Session tracking active' : '⚪ Session tracking inactive'}
          </div>
        )}
      </div>
    </div>
  );
}
