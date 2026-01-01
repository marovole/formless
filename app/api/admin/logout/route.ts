import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth/session'


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  await deleteSession()

  return NextResponse.json({ success: true })
}
