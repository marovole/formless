import { MetadataRoute } from 'next'
import { headers } from 'next/headers'

const locales = ['en', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  const baseUrl = host
    ? `${protocol}://${host}`
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://formless.pro')

  const routes = ['', '/chat', '/history', '/settings']

  const entries: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const route of routes) {
      entries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'weekly' : 'daily',
        priority: route === '' ? 1.0 : 0.8,
      })
    }
  }

  return entries
}
