'use client'

import { SignUp as ClerkSignUp } from '@clerk/nextjs'
import { useParams } from 'next/navigation'

export default function SignUpPage() {
  const params = useParams()
  const locale = params.locale as string
  const signUpUrl = `/${locale}/sign-up`
  const signInUrl = `/${locale}/sign-in`

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      <ClerkSignUp
        routing="path"
        path={signUpUrl}
        signInUrl={signInUrl}
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
