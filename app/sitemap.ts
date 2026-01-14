import { MetadataRoute } from 'next'

const locales = ['en', 'zh', 'ja', 'ko', 'de', 'fr', 'es', 'pt']

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://formless.ai'
  
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
