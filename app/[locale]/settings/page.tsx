'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string || 'zh';
  const { user, signOut } = useAuth();

  const handleLanguageChange = (newLocale: string) => {
    router.replace(`/${newLocale}/settings`);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push(`/${locale}/auth`);
  };

  if (!user) {
    router.push(`/${locale}/auth`);
    return null;
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
              <p className="text-stone-800">{user.email}</p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-stone-800 mb-4">Language</h2>
            <Select value={locale} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
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
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
