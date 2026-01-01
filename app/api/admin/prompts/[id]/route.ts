// @ts-nocheck - Supabase type system limitation with dynamic updates
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'


type PromptUpdate = Database['public']['Tables']['prompts']['Update']

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
  const updateObj: PromptUpdate = {}
  if ('content' in body && typeof body.content === 'string') {
    updateObj.content = body.content
  }
  if ('is_active' in body && typeof body.is_active === 'boolean') {
    updateObj.is_active = body.is_active
  }
  if ('description' in body && typeof body.description === 'string') {
    updateObj.description = body.description
  }

  if (Object.keys(updateObj).length > 0) {
    updateObj.version = (body.version || 1) + 1
  }

  const { data, error } = await supabase
    .from('prompts')
    .update(updateObj)
    .eq('id', id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data?.[0] })
}
