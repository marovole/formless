'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function EnsureCurrentUser({ preferredLanguage }: { preferredLanguage?: string }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const ensuredForUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (ensuredForUserIdRef.current === user.id) return;

    ensuredForUserIdRef.current = user.id;

    void ensureCurrent({
      preferredLanguage,
      fullName: user.fullName || undefined,
      avatarUrl: user.imageUrl || undefined,
    }).catch(() => {
      ensuredForUserIdRef.current = null;
    });
  }, [ensureCurrent, isLoaded, isSignedIn, preferredLanguage, user]);

  return null;
}

