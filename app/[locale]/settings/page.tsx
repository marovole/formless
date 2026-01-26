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
  const copy = locale === 'en'
    ? {
        title: 'Settings',
        subtitle: 'Manage your account preferences and experience',
        accountTitle: 'Account',
        accountSubtitle: 'View and manage your account details',
        emailLabel: 'Email',
        languageTitle: 'Language',
        languageSubtitle: 'Choose your preferred interface language',
        actionsTitle: 'Quick Actions',
        actionsSubtitle: 'Jump to common destinations',
        history: 'View Conversation History',
        letters: 'Open Letters Inbox',
        memory: 'Memory',
        signOut: 'Sign Out',
      }
    : {
        title: '设置',
        subtitle: '管理你的账户偏好和体验',
        accountTitle: '账户信息',
        accountSubtitle: '查看和管理的个人账户信息',
        emailLabel: '邮箱地址',
        languageTitle: '语言偏好',
        languageSubtitle: '选择你偏好的界面语言',
        actionsTitle: '快捷操作',
        actionsSubtitle: '快速访问其他功能',
        history: '查看对话历史',
        letters: '查看来信',
        memory: '记忆设置',
        signOut: '退出登录',
      };
  const { isSignedIn } = useAuth();
  const { user } = useUser();


  if (!isSignedIn || !user) {
    return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 p-4 sm:p-8">
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
        <div className="mb-8">
          <h1 className="text-3xl font-serif text-stone-800">{copy.title}</h1>
          <p className="text-sm text-stone-500 mt-1">{copy.subtitle}</p>
        </div>

        <div className="space-y-6">
          <Card className="p-6 border-stone-200/60">
            <div className="space-y-2 mb-4">
              <h2 className="text-lg font-semibold text-stone-800">{copy.accountTitle}</h2>
              <p className="text-xs text-stone-400">{copy.accountSubtitle}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-stone-500">{copy.emailLabel}</p>
              <p className="text-stone-800 font-medium">{user.primaryEmailAddress?.emailAddress}</p>
            </div>
          </Card>

          <Card className="p-6 border-stone-200/60">
            <div className="space-y-2 mb-4">
              <h2 className="text-lg font-semibold text-stone-800">{copy.languageTitle}</h2>
              <p className="text-xs text-stone-400">{copy.languageSubtitle}</p>
            </div>
            <LanguageSwitcher className="w-full" />
          </Card>

          <Card className="p-6 border-stone-200/60">
            <div className="space-y-2 mb-4">
              <h2 className="text-lg font-semibold text-stone-800">{copy.actionsTitle}</h2>
              <p className="text-xs text-stone-400">{copy.actionsSubtitle}</p>
            </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push(`/${locale}/settings/memory`)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2" aria-hidden="true">
                  <path d="M21 15a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h7"/>
                  <path d="M18 2v4"/>
                  <path d="M18 8v2"/>
                  <path d="M13 6h8"/>
                </svg>
                {copy.memory}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push(`/${locale}/history`)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2" aria-hidden="true">
                  <path d="M3 3v5h5"/>
                  <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
                  <path d="M12 7v5l4 2"/>
                </svg>
                {copy.history}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push(`/${locale}/letters`)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {copy.letters}
              </Button>
              <SignOutButton>
                <Button variant="destructive" className="w-full justify-start">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  {copy.signOut}
                </Button>
              </SignOutButton>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
