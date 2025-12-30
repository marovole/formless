import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export const runtime = 'edge';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  const body = await request.json()

  const supabase = getSupabaseAdminClient()

  const allowedFields = ['content', 'is_active', 'description']
  const updates: any = {}
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.version = (body.version || 1) + 1
  }

  const { data, error } = await supabase
    .from('prompts')
    // @ts-ignore - Supabase generated types issue with Update
    .update(updates)
    .eq('id', id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data?.[0] })
}
