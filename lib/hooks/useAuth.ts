'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

export function useAuthGuard() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth');
      }
    };

    checkAuth();
  }, [router, supabase]);
}

export function useAuth() {
  const supabase = createClient();

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    getSession,
    getUser,
    signOut,
  };
}
