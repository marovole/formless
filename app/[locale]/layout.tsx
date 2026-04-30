import { ClerkProvider } from '@clerk/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { GeistSans } from 'geist/font/sans'
import ConvexClientProvider from '@/components/ConvexClientProvider'
import { EnsureCurrentUser } from '@/components/EnsureCurrentUser'
import type { Metadata } from 'next'
import '@/app/globals.css'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://formless.pro'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })
  const keywords = t('keywords')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${siteUrl}/${l}`])
  ) as Record<string, string>

  return {
    metadataBase: new URL(siteUrl),
    title: t('title'),
    description: t('description'),
    keywords,
    authors: [{ name: 'Formless Team' }],
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      locale: t('ogLocale'),
      siteName: t('siteName'),
      url: `${siteUrl}/${locale}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages,
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  setRequestLocale(locale)

  const messages = await getMessages()
  const tApp = await getTranslations({ locale, namespace: 'app' })
  const tMeta = await getTranslations({ locale, namespace: 'metadata' })

  const signInUrl = `/${locale}/sign-in`
  const signUpUrl = `/${locale}/sign-up`
  const afterSignInUrl = `/${locale}/chat`
  const afterSignUpUrl = `/${locale}/chat`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tApp('name'),
    description: tMeta('description'),
    url: siteUrl,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'Formless Team',
    },
  }

  return (
    <html lang={locale} className={GeistSans.className}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <ClerkProvider
          signInUrl={signInUrl}
          signUpUrl={signUpUrl}
          afterSignInUrl={afterSignInUrl}
          afterSignUpUrl={afterSignUpUrl}
        >
          <NextIntlClientProvider messages={messages}>
            <ConvexClientProvider>
              <EnsureCurrentUser preferredLanguage={locale} />
              {children}
            </ConvexClientProvider>
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
