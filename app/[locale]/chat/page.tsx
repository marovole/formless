'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useSessionTracking, useGuanzhaoTriggers } from '@/lib/hooks/useSessionTracking';
import { MessageList, type ChatMessage } from '@/components/chat/MessageBubble';
import type { ToolSuggestion } from '@/components/chat/ToolSuggestionButtons';
import { useSSEChat } from '@/lib/hooks/useSSEChat';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthGuard } from '@/lib/hooks/useAuth';
import { UserButton } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { Template } from '@/lib/guanzhao/types';

const GuanzhaoTriggerContainer = dynamic(
  () =>
    import('@/components/guanzhao/GuanzhaoTriggerCard').then((m) => ({
      default: m.GuanzhaoTriggerContainer,
    })),
  { ssr: false }
);

function newMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ChatPage() {
  useAuthGuard();

  const t = useTranslations('chat');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationIdParam = searchParams.get('conversationId');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<Id<'conversations'> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, setPendingSuggestions] = useState<ToolSuggestion[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isStreaming, currentContent, sendMessage } = useSSEChat();

  const fireTrigger = useMutation(api.guanzhao.fireTrigger);
  const processAction = useMutation(api.guanzhao.processAction);

  const convexMessages = useQuery(
    api.messages.listByConversation,
    conversationId ? { conversationId } : 'skip'
  );

  useEffect(() => {
    if (convexMessages && !isStreaming) {
      setMessages(
        convexMessages.map((m) => ({
          id: String(m._id),
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      );
    }
  }, [convexMessages, isStreaming]);

  useEffect(() => {
    if (isStreaming && currentContent) {
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          lastMessage.content = currentContent;
        }
        return newMessages;
      });
    }
  }, [isStreaming, currentContent]);

  useEffect(() => {
    if (!conversationIdParam) return;
    setConversationId(conversationIdParam as Id<'conversations'>);
  }, [conversationIdParam]);

  const { isActive: sessionTrackingActive } = useSessionTracking(conversationId as string | null, {
    enabled: true,
    heartbeatInterval: 60000,
    pauseWhenHidden: true,
  });

  const { pendingTrigger, showTrigger, dismissTrigger } = useGuanzhaoTriggers();

  const handleTriggerAction = useCallback(
    async (action: string, triggerId: string) => {
      try {
        await processAction({ action, triggerId });
        dismissTrigger();
      } catch (error) {
        console.error('Error handling trigger action:', error);
      }
    },
    [dismissTrigger, processAction]
  );

  useEffect(() => {
    const handleTriggerEvent = (event: CustomEvent) => {
      const { triggerId } = event.detail;

      fireTrigger({ triggerId, channel: 'in_app' })
        .then((data: { allowed?: boolean; template?: Template }) => {
          if (data.allowed && data.template) {
            showTrigger(triggerId, data.template);
          }
        })
        .catch((error: unknown) => {
          console.error('Error firing trigger:', error);
        });
    };

    window.addEventListener('guanzhao:trigger', handleTriggerEvent as EventListener);

    return () => {
      window.removeEventListener('guanzhao:trigger', handleTriggerEvent as EventListener);
    };
  }, [fireTrigger, showTrigger]);

  const lastMessageContent = messages[messages.length - 1]?.content;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, lastMessageContent]);

  const handleSend = async (overrideMessage?: string) => {
    const messageText = (overrideMessage ?? input).trim();
    if (!messageText || isStreaming) return;

    const userMessage = messageText;
    setInput('');
    setErrorMessage(null);
    setPendingSuggestions([]);
    const userId = newMessageId();
    const assistantId = newMessageId();
    setMessages((prev) => [...prev, { id: userId, role: 'user', content: userMessage }]);

    try {
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      await sendMessage(userMessage, conversationId, locale, {
        onMetadata: (data) => {
          if (data.conversationId) {
            setConversationId(data.conversationId);
          }
        },
        onSuggestion: (data) => {
          if (data?.suggestions && Array.isArray(data.suggestions)) {
            setPendingSuggestions(data.suggestions);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                last.suggestions = data.suggestions as ToolSuggestion[];
              }
              return next;
            });
          }
        },
        onAudio: (data) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              last.audio = data;
            }
            return next;
          });
        },
        onError: (error) => {
          console.error('Stream error:', error);
        },
      });
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';

      setMessages((prev) => {
        const newMessages = [...prev];
        if (
          newMessages[newMessages.length - 1]?.role === 'assistant' &&
          newMessages[newMessages.length - 1]?.content === ''
        ) {
          newMessages.pop();
        }
        return [...newMessages, { id: newMessageId(), role: 'assistant', content: errorMsg, error: true }];
      });

      setErrorMessage(errorMsg);
    }
  };

  const handleRetry = async () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage && !isStreaming) {
      await handleSend(lastUserMessage.content);
    }
  };

  const chips = ['anxious', 'work', 'relationship', 'calm'] as const;

  return (
    <div className="h-screen max-h-[100dvh] bg-gradient-to-b from-stone-50 to-stone-100 flex flex-col relative overflow-hidden">
      <GuanzhaoTriggerContainer
        pendingTrigger={pendingTrigger}
        onDismiss={dismissTrigger}
        onAction={handleTriggerAction}
      />

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">
        <div className="flex-shrink-0 pb-4 border-b border-stone-200/50 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-serif text-stone-800">{t('title')}</h1>
              <p className="text-sm text-stone-500 mt-1">{t('subtitle')}</p>
            </div>
            <UserButton
              afterSignOutUrl={`/${locale}/auth`}
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9',
                },
              }}
            />
          </div>
          <div className="flex gap-3 mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-stone-500 hover:text-stone-700 h-auto py-1 px-2"
              onClick={() => router.push(`/${locale}/history`)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1.5"
                aria-hidden="true"
              >
                <path d="M3 3v5h5" />
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                <path d="M12 7v5l4 2" />
              </svg>
              {t('navHistory')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-stone-500 hover:text-stone-700 h-auto py-1 px-2"
              onClick={() => router.push(`/${locale}/settings`)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1.5"
                aria-hidden="true"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {t('navSettings')}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center py-8">
              <div className="max-w-md mx-auto space-y-6">
                <div className="space-y-2">
                  <p className="text-stone-600 font-light italic leading-relaxed">{t('quote')}</p>
                  <p className="text-xs text-stone-400">{t('quoteAuthor')}</p>
                </div>
                <div className="pt-4">
                  <p className="text-sm text-stone-500 mb-4">{t('prompt')}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {chips.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className="rounded-full border-stone-300 text-stone-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 transition-all duration-300"
                        onClick={() => handleSend(t(`chips.${key}.value`))}
                      >
                        {t(`chips.${key}.label`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <MessageList
                messages={messages}
                onRetry={handleRetry}
                onSuggestionChoose={(s) => {
                  const payload = `__tool:${s.tool}__ ${JSON.stringify(s.params)}`;
                  handleSend(payload);
                }}
              />
              {isStreaming && (
                <div
                  className="flex justify-start"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <span className="sr-only">{t('streamingStatus')}</span>
                  <Card className="max-w-[80%] p-4 bg-white border-stone-200">
                    <div className="flex gap-1" aria-hidden="true">
                      <span
                        className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {errorMessage && (
          <div
            className="mb-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t('placeholder')}
            disabled={isStreaming}
            className="flex-1"
            aria-label={t('messageComposerLabel')}
          />
          <Button
            onClick={() => handleSend()}
            disabled={isStreaming}
            aria-label={t('send')}
          >
            {isStreaming ? t('sending') : t('send')}
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-stone-400 mt-2 text-center">
            {sessionTrackingActive ? 'Session tracking active' : 'Session tracking inactive'}
          </div>
        )}
      </div>
    </div>
  );
}
