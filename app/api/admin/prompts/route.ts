import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .order('role', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
