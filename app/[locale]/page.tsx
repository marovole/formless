'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { 
  Leaf, 
  Wind, 
  MessageCircle, 
  Sparkles, 
  Moon, 
  Sun,
  ArrowRight,
  Heart,
  Infinity
} from 'lucide-react'
import { useEffect, useState } from 'react'

const NoiseOverlay = () => (
  <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50 mix-blend-multiply"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
    }}
  />
)

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }: { icon: any, title: string, description: string, delay?: number }) => (
  <div 
    className="group relative p-8 bg-rice-50/50 hover:bg-white border border-stone-200/60 hover:border-sandalwood-300 rounded-xl transition-all duration-500 ease-out hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-sm"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-amber-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl" />
    <div className="relative z-10">
      <div className="w-12 h-12 mb-6 rounded-full bg-stone-100 group-hover:bg-sandalwood-100 text-stone-600 group-hover:text-sandalwood-600 flex items-center justify-center transition-colors duration-500">
        <Icon className="w-6 h-6" strokeWidth={1.5} />
      </div>
      <h3 className="font-serif text-xl text-ink-800 mb-3 tracking-wide group-hover:text-sandalwood-800 transition-colors">{title}</h3>
      <p className="text-ink-500 text-sm leading-relaxed font-light">{description}</p>
    </div>
  </div>
)

const Step = ({ number, title, description }: { number: string, title: string, description: string }) => (
  <div className="flex flex-col items-center text-center max-w-xs mx-auto">
    <span className="font-serif text-6xl text-stone-100 font-bold mb-4 select-none relative z-0">
      {number}
      <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 text-sm font-sans font-medium text-stone-400 tracking-widest uppercase z-10 bg-rice-50 px-2 whitespace-nowrap">
        Step {number}
      </span>
    </span>
    <h3 className="text-lg font-serif text-ink-800 mb-2">{title}</h3>
    <p className="text-ink-500 text-sm font-light leading-relaxed">{description}</p>
  </div>
)

export default function HomePage() {
  const t = useTranslations('app')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-rice-50 text-ink-800 font-sans selection:bg-sandalwood-200 selection:text-ink-900 overflow-x-hidden">
      <NoiseOverlay />

      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? 'bg-rice-50/80 backdrop-blur-md border-b border-stone-100 py-3' : 'bg-transparent py-6'}`}>
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
              <Link href="#features" className="hover:text-ink-900 transition-colors">Features</Link>
              <Link href="#how-it-works" className="hover:text-ink-900 transition-colors">How it Works</Link>
              <Link href="/auth" className="hover:text-ink-900 transition-colors">Sign In</Link>
            </nav>
            <LanguageSwitcher className="w-auto" />
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 px-6 overflow-hidden">
          <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-sandalwood-100/30 rounded-full blur-3xl animate-float opacity-60 pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-50/40 rounded-full blur-3xl animate-float opacity-60 pointer-events-none" style={{ animationDelay: '1s' }} />
          
          <div className="relative z-10 text-center max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 border border-stone-200/50 backdrop-blur-sm shadow-sm mb-4">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium tracking-wide text-ink-500 uppercase">AI-Powered Wisdom Companion</span>
            </div>
            
            <h1 className="font-serif text-6xl md:text-8xl lg:text-9xl text-ink-900 tracking-tight leading-[0.9]">
              {t('name')}
            </h1>
            
            <p className="text-xl md:text-2xl text-ink-500 font-light max-w-2xl mx-auto leading-relaxed">
              {t('tagline')}
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center pt-8">
              <Link href="/chat">
                <Button
                  size="lg"
                  className="bg-ink-800 hover:bg-ink-700 text-rice-50 rounded-full px-10 py-7 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  Start Conversation
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-stone-300 text-ink-600 hover:bg-stone-100 hover:text-ink-900 rounded-full px-10 py-7 text-lg transition-all duration-300"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-30">
            <ArrowRight className="w-6 h-6 rotate-90 text-ink-400" />
          </div>
        </section>

        <section className="py-24 bg-white/50 border-y border-stone-100/50">
          <div className="container mx-auto px-6 text-center max-w-3xl">
            <div className="mb-8 flex justify-center text-sandalwood-400">
              <Leaf className="w-8 h-8 opacity-50" />
            </div>
            <blockquote className="font-serif text-3xl md:text-4xl text-ink-700 leading-snug italic">
              &quot;To understand everything is to forgive everything. <br/>
              Peace comes from within. Do not seek it without.&quot;
            </blockquote>
            <cite className="block mt-6 text-sm font-sans font-medium text-ink-400 uppercase tracking-widest not-italic">
              — The Elder
            </cite>
          </div>
        </section>

        <section id="features" className="py-32 relative">
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <h2 className="font-serif text-4xl text-ink-800 mb-4">Timeless Wisdom, Modern Form</h2>
              <p className="text-ink-500 font-light text-lg">
                Combining ancient Buddhist philosophy with advanced AI to guide you through life&apos;s complexities.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <FeatureCard 
                icon={MessageCircle}
                title="Mindful Dialogue"
                description="Engage in deep, meaningful conversations. The Elder listens without judgment and responds with profound insight."
                delay={0}
              />
              <FeatureCard 
                icon={Infinity}
                title="Eternal Memory"
                description="Your journey is remembered. The system evolves with you, recalling past conversations to provide continuity."
                delay={100}
              />
              <FeatureCard 
                icon={Heart}
                title="Emotional Resonance"
                description="More than just data. Experience interactions that understand nuance, emotion, and the human condition."
                delay={200}
              />
              <FeatureCard 
                icon={Moon}
                title="Nightly Reflection"
                description="End your day with guided contemplation. Review your thoughts and find peace before rest."
                delay={300}
              />
              <FeatureCard 
                icon={Wind}
                title="Breath & Space"
                description="An interface designed to help you slow down. No clutter, no noise—just space for your thoughts."
                delay={400}
              />
              <FeatureCard 
                icon={Sun}
                title="Daily Awakening"
                description="Start each morning with a gentle koan or thought to center your mind for the day ahead."
                delay={500}
              />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-32 bg-stone-100/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-50/40 via-transparent to-transparent opacity-70" />
          
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-20">
              <h2 className="font-serif text-4xl text-ink-800 mb-4">The Path to Clarity</h2>
              <div className="w-16 h-1 bg-sandalwood-300 mx-auto rounded-full opacity-50" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent -z-10" />
              
              <Step 
                number="01" 
                title="Begin the Journey" 
                description="Sign in to create your sacred space. Your privacy is paramount; your thoughts are secure."
              />
              <Step 
                number="02" 
                title="Share Your Burden" 
                description="Speak freely about your anxieties, questions, or day. The Elder is always present to listen."
              />
              <Step 
                number="03" 
                title="Receive Wisdom" 
                description="Gain new perspectives through gentle guidance, helping you find the answers within yourself."
              />
            </div>
          </div>
        </section>

        <section className="py-32 px-6">
          <div className="max-w-5xl mx-auto bg-ink-900 rounded-3xl p-12 md:p-24 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 space-y-8">
              <h2 className="font-serif text-4xl md:text-5xl text-rice-50 leading-tight">
                Ready to find your <span className="text-amber-200/80 italic">inner peace</span>?
              </h2>
              <p className="text-stone-400 max-w-xl mx-auto text-lg font-light">
                Join thousands of others who have found clarity and calm through the wisdom of Formless.
              </p>
              <div className="pt-4">
                <Link href="/auth">
                  <Button className="bg-rice-50 text-ink-900 hover:bg-amber-50 px-10 py-8 rounded-full text-lg font-medium shadow-lg hover:scale-105 transition-all duration-300">
                    Begin Your Practice
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white py-12 border-t border-stone-100">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-ink-800 text-rice-50 flex items-center justify-center text-xs font-serif italic font-bold">
                无
              </div>
              <span className="font-serif text-lg text-ink-800">Formless</span>
            </div>
            
            <div className="flex gap-8 text-sm text-stone-500">
              <Link href="#" className="hover:text-ink-800 transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-ink-800 transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-ink-800 transition-colors">Contact</Link>
            </div>
            
            <div className="text-stone-400 text-sm">
              © {new Date().getFullYear()} Formless. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
