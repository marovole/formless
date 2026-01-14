import Link from 'next/link'
import { Card } from '@/components/ui/card'

export default async function AdminDashboard() {
  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-zinc-600">Admin tools and monitoring</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold">API Keys</h2>
            <p className="mt-1 text-sm text-zinc-600">Manage provider keys and quotas</p>
            <Link className="mt-4 inline-block text-sm underline" href="/admin/api-keys">
              Open
            </Link>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Prompts</h2>
            <p className="mt-1 text-sm text-zinc-600">Edit system prompts and versions</p>
            <Link className="mt-4 inline-block text-sm underline" href="/admin/prompts">
              Open
            </Link>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Usage</h2>
            <p className="mt-1 text-sm text-zinc-600">View daily usage statistics</p>
            <Link className="mt-4 inline-block text-sm underline" href="/admin/usage">
              Open
            </Link>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold">Users</h2>
            <p className="mt-1 text-sm text-zinc-600">Inspect user records</p>
            <Link className="mt-4 inline-block text-sm underline" href="/admin/users">
              Open
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
