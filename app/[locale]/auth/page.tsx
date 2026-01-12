'use client';

import { SignIn } from "@clerk/nextjs";
import { Card } from '@/components/ui/card';

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100">
      <div className="w-full max-w-md p-4">
        <SignIn />
      </div>
    </div>
  );
}
