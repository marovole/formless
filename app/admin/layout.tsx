import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export const runtime = 'edge';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
