'use client';

import { useAuth as useClerkAuth, useUser } from "@clerk/nextjs";

export interface User {
  id: string;
  email?: string;
}

export function useAuth() {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerkAuth();

  const user: User | null = isSignedIn && clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress,
  } : null;

  return {
    user,
    loading: !isLoaded,
    signOut,
    // define dummy signIn/signUp to avoid breaking strict types if necessary,
    // but better to remove them and fix call sites.
    // I verified only auth/page.tsx uses them, and I will fix it.
  };
}

// Legacy export if needed, but we removed usage in layout.
// export function AuthProvider...
