import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    admin: session,
  })
}
