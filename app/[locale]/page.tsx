import { setRequestLocale } from 'next-intl/server';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingSections } from '@/components/landing/LandingSections';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Required for next-intl's useTranslations to resolve in the static
  // server-rendered sections below.
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-rice-50 text-ink-800 font-sans selection:bg-sandalwood-200 selection:text-ink-900 overflow-x-hidden">
      <LandingHeader />
      <LandingSections />
    </div>
  );
}
