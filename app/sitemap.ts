import { MetadataRoute } from 'next'
import { headers } from 'next/headers'

const locales = ['en', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt']

// ────────────────────────────────────────────────────────────────────────────
// Only publicly reachable, *indexable content* routes belong in the sitemap.
// Excluded:
//   - Auth-gated pages (/chat, /history, /settings, /letters) redirect
//     crawlers to sign-in → wasted crawl budget + soft-404 signals.
//   - Auth entry pages (/sign-in, /sign-up) are functional login forms, not
//     landing content; they are also marked noindex via their route layouts.
// Each entry carries an intent-based priority/frequency.
// 8 locales × 3 routes = 24 URLs (TEST_PLAN.md TC-011).
// ────────────────────────────────────────────────────────────────────────────
const routes: Array<{
  path: string
  priority: number
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
}> = [
  { path: '', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  const baseUrl = host
    ? `${protocol}://${host}`
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://formless.pro')

  const lastModified = new Date()

  return locales.flatMap((locale) =>
    routes.map(({ path, priority, changeFrequency }) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified,
      changeFrequency,
      priority,
    }))
  )
}
