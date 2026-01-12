import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950">
      <SignUp
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
