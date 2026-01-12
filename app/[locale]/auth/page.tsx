'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

/**
 * 旧认证页面 - 重定向到 Clerk 登录
 */
export default function AuthPage() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.replace(`/${locale}/sign-in`);
  }, [router, locale]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Redirecting to sign in...</p>
    </div>
  );
}
