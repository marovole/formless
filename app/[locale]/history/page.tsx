'use client';

import { useRouter, useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useAuthGuard } from '@/lib/hooks/useAuth';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTranslations } from 'next-intl';
import { toDateLocale } from '@/lib/dateLocale';

export default function HistoryPage() {
  useAuthGuard();

  const t = useTranslations('history');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'zh';
  const dateLocale = toDateLocale(locale);

  const conversations = useQuery(api.conversations.list, { limit: 50 });
  const removeConversation = useMutation(api.conversations.remove);

  const handleDelete = async (id: Id<'conversations'>) => {
    if (!confirm(t('confirmDelete'))) {
      return;
    }

    try {
      await removeConversation({ id });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleContinue = (id: Id<'conversations'>) => {
    router.push(`/${locale}/chat?conversationId=${id}`);
  };

  if (conversations === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-serif text-stone-800 mb-8">{t('title')}</h1>
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-serif text-stone-800 mb-8">{t('title')}</h1>

        {conversations.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-stone-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-stone-400"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-stone-500">{t('emptyTitle')}</p>
              <p className="text-sm text-stone-400">{t('emptySubtitle')}</p>
            </div>
            <Button onClick={() => router.push(`/${locale}/chat`)} className="mt-4">
              {t('emptyCta')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map(
              (conv: { _id: Id<'conversations'>; _creationTime: number; preview: string }) => (
                <Card key={String(conv._id)} className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-500 mb-2">
                        {new Date(conv._creationTime).toLocaleDateString(dateLocale)}
                      </p>
                      <p className="text-stone-700 truncate sm:whitespace-normal">{conv.preview}...</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleContinue(conv._id)}
                        className="flex-1 sm:flex-none"
                      >
                        {t('continue')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(conv._id)}
                        className="flex-1 sm:flex-none"
                      >
                        {t('delete')}
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            )}
          </div>
        )}

        <div className="mt-8">
          <Button onClick={() => router.push(`/${locale}/chat`)}>{t('startNew')}</Button>
        </div>
      </div>
    </div>
  );
}
