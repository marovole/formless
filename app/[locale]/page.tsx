import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const t = useTranslations('app')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-stone-50 via-amber-50/30 to-stone-100 px-4">
      <div className="text-center max-w-4xl">
        <h1 className="font-serif text-7xl md:text-8xl text-stone-900 mb-6 tracking-tight">
          {t('name')}
        </h1>
        <p className="text-2xl md:text-3xl text-stone-600 mb-4 font-light">
          {t('tagline')}
        </p>
        <p className="text-lg text-stone-500 mb-12 max-w-2xl mx-auto">
          A wise companion for your journey through life&apos;s questions.
          Guided by the wisdom of a Buddhist elder, find clarity in conversation.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/chat">
            <Button
              size="lg"
              className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Start Conversation
            </Button>
          </Link>
          <Link href="/auth">
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg border-stone-300 hover:border-amber-600 hover:text-amber-700 transition-all"
            >
              Sign In
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto text-left">
          <div className="bg-white/50 backdrop-blur-sm p-6 rounded-lg border border-stone-200">
            <h3 className="font-serif text-xl text-stone-800 mb-2">Thoughtful Dialogue</h3>
            <p className="text-stone-600 text-sm">
              Engage in meaningful conversations with a wise elder who listens deeply.
            </p>
          </div>
          <div className="bg-white/50 backdrop-blur-sm p-6 rounded-lg border border-stone-200">
            <h3 className="font-serif text-xl text-stone-800 mb-2">Remembers You</h3>
            <p className="text-stone-600 text-sm">
              Your conversations build a relationship. The elder remembers your journey.
            </p>
          </div>
          <div className="bg-white/50 backdrop-blur-sm p-6 rounded-lg border border-stone-200">
            <h3 className="font-serif text-xl text-stone-800 mb-2">Bilingual Support</h3>
            <p className="text-stone-600 text-sm">
              Speak in English or Chinese. Wisdom transcends language barriers.
            </p>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-stone-200">
          <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600">
            Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
