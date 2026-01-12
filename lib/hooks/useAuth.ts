'use client';

import { useAuth as useClerkAuth, useUser } from '@clerk/nextjs';
import { useRouter } from '@/i18n/routing';
import { useCallback, useEffect } from 'react';

export function useAuthGuard(redirectTo = '/sign-in') {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useClerkAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push(redirectTo);
    }
  }, [isLoaded, isSignedIn, router, redirectTo]);
}

export function useAuth() {
  const { isSignedIn, isLoaded: clerkLoaded, signOut: clerkSignOut } = useClerkAuth();
  const { user, isLoaded: userLoaded } = useUser();

  const isLoaded = clerkLoaded && userLoaded;
  const isSigned = isSignedIn;

  const getSession = useCallback(async () => {
    // Clerk handles session automatically
    return user ? { id: user.id, email: user.primaryEmailAddress?.emailAddress } : null;
  }, [user]);

  const getUser = useCallback(async () => {
    return user ?? null;
  }, [user]);

  const signOut = useCallback(async () => {
    await clerkSignOut();
    window.location.href = '/';
  }, [clerkSignOut]);

  return {
    user,
    isLoaded,
    isSignedIn: isSigned,
    getSession,
    getUser,
    signOut,
  };
}
