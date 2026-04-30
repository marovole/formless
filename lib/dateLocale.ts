import type { Locale } from '@/i18n/routing'

const localeToBcp47: Record<Locale, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-BR',
}

export function toDateLocale(locale: string): string {
  return localeToBcp47[locale as Locale] ?? 'en-US'
}
