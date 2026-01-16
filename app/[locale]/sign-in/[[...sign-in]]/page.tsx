import { SignIn as ClerkSignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      <ClerkSignIn
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
