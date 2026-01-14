'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthGuard } from '@/lib/hooks/useAuth';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import type { Id } from '@/convex/_generated/dataModel';

type ThreadData = {
  thread: {
    _id: Id<'letter_threads'>;
    subject?: string;
    last_letter_at: number;
  };
  currentUserId: Id<'users'>;
  canSend: boolean;
  counterpart: {
    full_name: string;
    email: string;
    avatar_url: string;
  } | null;
};

type LetterRow = {
  _id: Id<'letters'>;
  sender_id: Id<'users'>;
  recipient_id: Id<'users'>;
  body: string;
  created_at: number;
};

export default function LetterThreadPage() {
  useAuthGuard();

  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'zh';
  const threadId = params.threadId as string;

  const threadData = useQuery(api.letter_threads.getThread, {
    threadId: threadId as Id<'letter_threads'>,
  }) as ThreadData | null | undefined;

  const letters = useQuery(
    api.letters.listByThread,
    threadId ? { threadId: threadId as Id<'letter_threads'> } : 'skip'
  ) as LetterRow[] | undefined;

  const reply = useMutation(api.letter_threads.reply);

  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReply = async () => {
    if (!body.trim() || isSending || !threadData?.canSend) return;
    setIsSending(true);
    setErrorMessage(null);

    try {
      await reply({ threadId: threadId as Id<'letter_threads'>, body });
      setBody('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send letter';
      setErrorMessage(message);
    } finally {
      setIsSending(false);
    }
  };

  if (threadData === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rice-50 via-white to-stone-100 p-4 sm:p-8">
        <Card className="p-6 text-stone-500">Loading letter thread...</Card>
      </div>
    );
  }

  if (threadData === null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rice-50 via-white to-stone-100 p-4 sm:p-8">
        <Card className="p-6 text-stone-500">Thread not found.</Card>
      </div>
    );
  }

  const counterpartName = threadData.counterpart?.full_name || threadData.counterpart?.email || 'Unknown';

  return (
    <div className="min-h-screen bg-gradient-to-b from-rice-50 via-white to-stone-100">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <button
              onClick={() => router.push(`/${locale}/letters`)}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              ← Back to inbox
            </button>
            <h1 className="text-3xl font-serif text-ink-800">
              {threadData.thread.subject || 'Untitled letter'}
            </h1>
            <p className="text-sm text-stone-500">With {counterpartName}</p>
          </div>
          <span
            className={`text-xs px-3 py-1 rounded-full border ${
              threadData.canSend
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-stone-200 bg-stone-100 text-stone-500'
            }`}
          >
            {threadData.canSend ? 'Your turn to reply' : 'Waiting for reply'}
          </span>
        </div>

        <div className="space-y-6">
          {letters === undefined ? (
            <Card className="p-6 text-stone-500">Loading letters...</Card>
          ) : letters.length === 0 ? (
            <Card className="p-6 text-stone-500">No letters yet.</Card>
          ) : (
            letters.map((letter) => {
              const isMine = letter.sender_id === threadData.currentUserId;
              const date = new Date(letter.created_at).toLocaleDateString();
              return (
                <Card
                  key={letter._id}
                  className={`p-6 sm:p-8 border-stone-200/70 bg-[linear-gradient(180deg,#fffdf7_0%,#fdf8ee_100%)] shadow-[0_12px_40px_rgba(0,0,0,0.08)] ${
                    isMine ? 'ring-1 ring-amber-100' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-stone-400">
                    <span>{date}</span>
                    <span>{isMine ? 'From you' : `From ${counterpartName}`}</span>
                  </div>
                  <div className="mt-4 font-handwriting text-lg leading-relaxed text-ink-700 whitespace-pre-wrap">
                    {letter.body}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <Card className="p-6 sm:p-8 bg-white/80 border-stone-200/70">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-serif text-ink-800">Your Reply</h2>
              <span className="text-xs uppercase tracking-[0.2em] text-stone-400">Slow pace</span>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={threadData.canSend ? 'Write your reply...' : 'Waiting for a reply before you can write again.'}
              rows={6}
              disabled={!threadData.canSend}
              className="bg-white/70 border-stone-200 font-handwriting text-lg leading-relaxed text-ink-700"
            />
            {errorMessage && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-500">
                You can only reply when it is your turn.
              </p>
              <Button onClick={handleReply} disabled={!threadData.canSend || isSending}>
                {isSending ? 'Sending...' : 'Send Reply'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
