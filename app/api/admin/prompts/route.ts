// @ts-nocheck - Supabase type system limitation with dynamic inserts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

interface PromptBody {
  name: string
  role: 'formless_elder' | 'memory_extractor' | 'system'
  language: 'zh' | 'en'
  content: string
  description?: string
  is_active?: boolean
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const supabase = getSupabaseAdminClient()
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const language = searchParams.get('language')

  let query = supabase
    .from('prompts')
    .select('*')
    .order('role', { ascending: true })
    .order('language', { ascending: true })

  if (role) {
    query = query.eq('role', role)
  }
  if (language) {
    query = query.eq('language', language)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const body: PromptBody = await request.json()

  if (!body.name || !body.role || !body.content) {
    return NextResponse.json(
      { error: 'Name, role, and content are required' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('prompts')
    .insert([{
      name: body.name,
      role: body.role,
      language: body.language || 'zh',
      content: body.content,
      description: body.description || null,
      is_active: body.is_active ?? true,
      version: 1,
    }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  const supabase = getSupabaseAdminClient()

  // Increment version if content changed
  if (updates.content) {
    const { data: existing } = await supabase
      .from('prompts')
      .select('version')
      .eq('id', id)
      .single()

    if (existing) {
      updates.version = (existing.version || 0) + 1
    }
  }

  const { data, error } = await supabase
    .from('prompts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  const supabase = getSupabaseAdminClient()

  const { error } = await supabase
    .from('prompts')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
