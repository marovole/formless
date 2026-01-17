'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useLocale } from 'next-intl';

export function useAuthGuard() {
  const router = useRouter();
  const locale = useLocale();
  const { isLoaded, userId } = useClerkAuth();
  const signInPath = `/${locale}/sign-in`;

  useEffect(() => {
    if (isLoaded && !userId) {
      router.push(signInPath);
    }
  }, [isLoaded, userId, router, signInPath]);
}

export function useAuth() {
  const { userId, signOut } = useClerkAuth();

  const getSession = async () => {
    // Return mock session if compatible, or just null/true
    return userId ? { user: { id: userId } } : null;
  };

  const getUser = async () => {
    return userId ? { id: userId } : null;
  };

  return {
    getSession,
    getUser,
    signOut,
  };
}
