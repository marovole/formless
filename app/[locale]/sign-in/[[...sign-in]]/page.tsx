import { SignIn as ClerkSignIn } from '@clerk/nextjs'

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
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
