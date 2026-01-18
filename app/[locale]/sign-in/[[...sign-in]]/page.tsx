'use client'

import { SignIn as ClerkSignIn } from '@clerk/nextjs'
import { useParams } from 'next/navigation'

export default function SignInPage() {
  const params = useParams()
  const locale = params.locale as string
  const signInUrl = `/${locale}/sign-in`
  const signUpUrl = `/${locale}/sign-up`

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      <ClerkSignIn
        routing="path"
        path={signInUrl}
        signUpUrl={signUpUrl}
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl',
          }
        }}
      />
    </div>
  )
}
