'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthGuard } from '@/lib/hooks/useAuth';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { toDateLocale } from '@/lib/dateLocale';

type ThreadRow = {
  _id: string;
  subject: string;
  last_letter_at: number;
  last_letter_preview: string;
  canSend: boolean;
  counterpart: {
    full_name: string;
    email: string;
    avatar_url: string;
  } | null;
};

export default function LettersPage() {
  useAuthGuard();

  const t = useTranslations('letters');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'zh';
  const dateLocale = toDateLocale(locale);

  const threads = useQuery(api.letter_threads.listForCurrentUser, { limit: 50 }) as
    | ThreadRow[]
    | undefined;
  const createWithLetter = useMutation(api.letter_threads.createWithLetter);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSend = async () => {
    if (!recipientEmail.trim() || !body.trim() || isSending) return;
    setIsSending(true);
    setErrorMessage(null);

    try {
      const threadId = await createWithLetter({
        recipientEmail,
        subject: subject.trim() ? subject : undefined,
        body,
      });
      setBody('');
      setSubject('');
      router.push(`/${locale}/letters/${threadId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('sendFailed');
      setErrorMessage(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rice-50 via-white to-stone-100">
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-10">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-stone-400">{t('badge')}</p>
          <h1 className="text-4xl font-serif text-ink-800">{t('title')}</h1>
          <p className="text-stone-600">{t('subtitle')}</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="p-6 sm:p-8 bg-[linear-gradient(180deg,#fffdf7_0%,#fdf8ee_100%)] border-stone-200/70 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif text-ink-800">{t('writeTitle')}</h2>
                <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
                  {t('dailyRhythm')}
                </span>
              </div>
              <div className="space-y-3">
                <Input
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder={t('recipientPlaceholder')}
                  className="bg-white/60 border-stone-200"
                />
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('subjectPlaceholder')}
                  className="bg-white/60 border-stone-200"
                />
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('bodyPlaceholder')}
                  rows={8}
                  className="bg-white/70 border-stone-200 font-handwriting text-lg leading-relaxed text-ink-700"
                />
              </div>

              {errorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-xs text-stone-500">{t('alternateHint')}</p>
                <Button onClick={handleSend} disabled={isSending}>
                  {isSending ? t('sending') : t('sendLetter')}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 sm:p-8 bg-white/80 border-stone-200/70">
            <div className="space-y-4">
              <h3 className="text-lg font-serif text-ink-800">{t('howItWorksTitle')}</h3>
              <ul className="space-y-3 text-sm text-stone-600">
                <li>{t('howItWorks1')}</li>
                <li>{t('howItWorks2')}</li>
                <li>{t('howItWorks3')}</li>
              </ul>
              <div className="border-t border-stone-200 pt-4 text-xs uppercase tracking-[0.25em] text-stone-400">
                {t('slowIsFast')}
              </div>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif text-ink-800">{t('inbox')}</h2>
            <span className="text-sm text-stone-500">
              {threads ? t('threadsCount', { count: threads.length }) : t('loadingThreads')}
            </span>
          </div>

          {threads === undefined ? (
            <Card className="p-6 text-stone-500">{t('loadingLetters')}</Card>
          ) : threads.length === 0 ? (
            <Card className="p-6 text-stone-500">{t('emptyInbox')}</Card>
          ) : (
            <div className="space-y-4">
              {threads.map((thread) => {
                const name =
                  thread.counterpart?.full_name ||
                  thread.counterpart?.email ||
                  t('unknownCounterpart');
                const date = new Date(thread.last_letter_at).toLocaleDateString(dateLocale);
                return (
                  <Card
                    key={thread._id}
                    className="p-5 sm:p-6 bg-white/80 border-stone-200/70 hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm uppercase tracking-[0.2em] text-stone-400">
                            {date}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${
                              thread.canSend
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-stone-200 bg-stone-100 text-stone-500'
                            }`}
                          >
                            {thread.canSend ? t('yourTurn') : t('waiting')}
                          </span>
                        </div>
                        <h3 className="text-lg font-serif text-ink-800">
                          {thread.subject || t('untitled')}
                        </h3>
                        <p className="text-sm text-stone-500">{t('with', { name })}</p>
                        <p className="text-base font-handwriting text-ink-700 leading-relaxed">
                          {thread.last_letter_preview || '...'}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          variant="outline"
                          onClick={() => router.push(`/${locale}/letters/${thread._id}`)}
                        >
                          {t('openThread')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
