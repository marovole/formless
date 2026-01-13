'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth, useUser, SignOutButton } from '@clerk/nextjs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthGuard } from '@/lib/hooks/useAuth';

export default function SettingsPage() {
  useAuthGuard();

  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'zh';
  const { isSignedIn } = useAuth();
  const { user } = useUser();


  if (!isSignedIn || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 p-8">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-serif text-stone-800 mb-8">Settings</h1>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-stone-800 mb-4">Account</h2>
            <div className="space-y-2">
              <p className="text-sm text-stone-600">Email</p>
              <p className="text-stone-800">{user.primaryEmailAddress?.emailAddress}</p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-stone-800 mb-4">Language</h2>
            <LanguageSwitcher className="w-full" />
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-stone-800 mb-4">Actions</h2>
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/${locale}/history`)}
              >
                View Conversation History
              </Button>
              <SignOutButton>
                <Button variant="destructive" className="w-full">
                  Sign Out
                </Button>
              </SignOutButton>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
