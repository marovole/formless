'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { logger } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    logger.error('Application error', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-serif text-stone-800 mb-2">
            出错了
          </h2>
          <p className="text-stone-600 text-sm">
            抱歉，发生了一些问题。请稍后重试。
          </p>
          {process.env.NODE_ENV === 'development' && error.message && (
            <p className="mt-4 p-3 bg-stone-100 rounded text-xs text-stone-500 text-left font-mono break-all">
              {error.message}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            重试
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="w-full"
          >
            返回首页
          </Button>
        </div>
      </Card>
    </div>
  );
}
