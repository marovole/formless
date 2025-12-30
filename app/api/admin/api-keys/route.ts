import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .order('priority', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json()
  const { provider, api_key, model_name, daily_limit, priority } = body

  if (!provider || !api_key) {
    return NextResponse.json(
      { error: 'Provider and API key are required' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('api_keys')
    // @ts-ignore - Supabase generated types issue with Insert
    .insert([
      {
        provider,
        api_key,
        model_name: model_name || null,
        daily_limit: daily_limit || 1000,
        priority: priority || 1,
      },
    ])
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data[0] })
}
