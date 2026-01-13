import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function AdminDashboard() {
  const session = await getSession()

  if (!session) {
    redirect('/admin/login')
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-zinc-600">Welcome, {session.email}</p>
      </div>
    </div>
  )
}
