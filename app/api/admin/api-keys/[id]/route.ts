// @ts-nocheck - Supabase type system limitation with dynamic updates
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'


type ApiKeyUpdate = Database['public']['Tables']['api_keys']['Update']

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  const body = await request.json()

  const supabase = getSupabaseAdminClient()

  // Build update object with explicit type checks
  const updateObj: ApiKeyUpdate = {}
  if ('daily_limit' in body && typeof body.daily_limit === 'number') {
    updateObj.daily_limit = body.daily_limit
  }
  if ('priority' in body && typeof body.priority === 'number') {
    updateObj.priority = body.priority
  }
  if ('is_active' in body && typeof body.is_active === 'boolean') {
    updateObj.is_active = body.is_active
  }
  if ('model_name' in body && (body.model_name === null || typeof body.model_name === 'string')) {
    updateObj.model_name = body.model_name
  }

  const { data, error } = await supabase
    .from('api_keys')
    .update(updateObj)
    .eq('id', id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data?.[0] })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  const supabase = getSupabaseAdminClient()

  const { error } = await supabase.from('api_keys').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
