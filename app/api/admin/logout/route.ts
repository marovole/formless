import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth/session'

export const runtime = 'edge';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  await deleteSession()

  return NextResponse.json({ success: true })
}
