'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useAuth as useClerkAuth } from "@clerk/nextjs";

export function useAuthGuard() {
  const router = useRouter();
  const { isLoaded, userId } = useClerkAuth();

  useEffect(() => {
    if (isLoaded && !userId) {
      router.push('/sign-in');
    }
  }, [isLoaded, userId, router]);
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
