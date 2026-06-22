'use client';

// ────────────────────────────────────────────────────────────────────────────
// LandingHeader — the only interactive island on the landing page.
// Everything else (hero, features, CTA, footer) is server-rendered static HTML
// in LandingSections, so the browser paints content before this hydrates.
// Responsibilities: scroll-aware frosted header + mobile menu toggle.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';

export function LandingHeader() {
  const t = useTranslations('landing');
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? 'bg-rice-50/80 backdrop-blur-md border-b border-stone-100 py-3' : 'bg-transparent py-6'}`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2 z-50">
          <div className="w-8 h-8 rounded-full bg-ink-800 text-rice-50 flex items-center justify-center font-serif italic font-bold group-hover:scale-105 transition-transform duration-300">
            无
          </div>
          <span className="font-serif text-xl tracking-tight text-ink-800 group-hover:text-ink-600 transition-colors">
            Formless
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-500 font-medium">
            <Link href="#features" className="hover:text-ink-900 transition-colors">
              {t('nav.features')}
            </Link>
            <Link href="#how-it-works" className="hover:text-ink-900 transition-colors">
              {t('nav.howItWorks')}
            </Link>
            <Link href="/sign-in" className="hover:text-ink-900 transition-colors">
              {t('nav.signIn')}
            </Link>
          </nav>
          <LanguageSwitcher className="w-auto" />
          <button
            type="button"
            className="md:hidden p-2 text-ink-600 hover:text-ink-900 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <nav className="md:hidden bg-rice-50/95 backdrop-blur-md border-t border-stone-100 px-6 py-4 flex flex-col gap-4">
          <Link
            href="#features"
            className="text-ink-600 hover:text-ink-900 transition-colors py-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            {t('nav.features')}
          </Link>
          <Link
            href="#how-it-works"
            className="text-ink-600 hover:text-ink-900 transition-colors py-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            {t('nav.howItWorks')}
          </Link>
          <Link
            href="/sign-in"
            className="text-ink-600 hover:text-ink-900 transition-colors py-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            {t('nav.signIn')}
          </Link>
        </nav>
      )}
    </header>
  );
}
