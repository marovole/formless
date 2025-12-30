import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { GeistSans } from 'geist/font/sans'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import type { Metadata } from 'next'
import '@/app/globals.css'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export const metadata: Metadata = {
  title: '无相 Formless - AI Wisdom Companion',
  description: 'A wise AI companion guided by Buddhist philosophy. Find clarity through thoughtful conversations with an elder who remembers your journey.',
  keywords: ['AI', 'Buddhist philosophy', 'wisdom', 'conversation', 'mindfulness', 'companion'],
  authors: [{ name: 'Formless Team' }],
  openGraph: {
    title: '无相 Formless - AI Wisdom Companion',
    description: 'Find clarity through conversations with a wise AI elder',
    type: 'website',
    locale: 'en_US',
    siteName: 'Formless',
  },
  twitter: {
    card: 'summary_large_image',
    title: '无相 Formless - AI Wisdom Companion',
    description: 'Find clarity through conversations with a wise AI elder',
  },
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as any)) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <html lang={locale} className={GeistSans.className}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
