import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://formless.pro'

// ────────────────────────────────────────────────────────────────────────────
// Per-page canonical + hreflang alternates.
//
// These MUST be generated at the page level, never in the shared [locale]
// layout: App Router inherits a layout's `alternates`, so a layout-level
// canonical makes every sub-route (/privacy, /terms, …) declare the homepage
// as its canonical and fold itself away. Each public page calls this with its
// own path so it points at itself.
//
// `path` is the route after the locale segment: '' for home, '/privacy', etc.
// ────────────────────────────────────────────────────────────────────────────
export function localeAlternates(locale: string, path = ''): Metadata['alternates'] {
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${siteUrl}/${l}${path}`])
  ) as Record<string, string>

  return {
    canonical: `${siteUrl}/${locale}${path}`,
    languages,
  }
}
