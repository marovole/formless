import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  await deleteSession()

  return NextResponse.json({ success: true })
}
