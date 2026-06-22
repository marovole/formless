import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { localeAlternates } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates(locale, '/terms') };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <div className="min-h-screen bg-rice-50 py-16 px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="font-serif text-3xl text-ink-800">{t('termsTitle')}</h1>
        <Card className="p-8 border-stone-200/70">
          <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{t('termsBody')}</p>
        </Card>
        <Button variant="outline" asChild>
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    </div>
  );
}
