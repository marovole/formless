import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from './session'

export async function requireAuth(request: NextRequest) {
  const session = await getSessionFromRequest(request)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return session
}
