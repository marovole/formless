'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useSessionTracking, useGuanzhaoTriggers } from '@/lib/hooks/useSessionTracking';
import { GuanzhaoTriggerContainer } from '@/components/guanzhao/GuanzhaoTriggerCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
          language: 'zh',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('event: metadata')) {
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6));
              setConversationId(data.conversationId);
            }
          }

          if (line.startsWith('event: chunk')) {
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6));
              assistantMessage += data.content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = assistantMessage;
                return newMessages;
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, an error occurred.' },
      ]);
    } finally {
      setIsLoading(false);
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
                    : 'bg-white border-stone-200'
                }`}
              >
                <p className="whitespace-pre-wrap text-stone-800">{msg.content}</p>
              </Card>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

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
