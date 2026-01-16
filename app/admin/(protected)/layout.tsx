import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getConvexClientWithAuth } from '@/lib/convex'
import { api } from '@/convex/_generated/api'

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.ADMIN_EMAILS
  if (!raw) return false
  const allowlist = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
  if (allowlist.size === 0) return false
  return allowlist.has(email.toLowerCase())
}

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const { userId, getToken } = await auth()
    if (!userId) {
      redirect('/en/sign-in')
    }

    const user = await currentUser()
    const email =
      user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress

    if (!isAdminEmail(email)) {
      redirect('/en')
    }

    const token = await getToken({ template: 'convex' })
    if (token) {
      const convex = getConvexClientWithAuth(token)
      await convex.mutation(api.users.ensureCurrent, {
        fullName: user?.fullName || undefined,
        avatarUrl: user?.imageUrl || undefined,
      })
    }

    return <>{children}</>
  } catch (error) {
    console.error('Admin layout error:', error)
    redirect('/en/sign-in')
  }
}

