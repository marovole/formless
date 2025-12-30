import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const supabase = getSupabaseAdminClient()

  const { data: usageData } = await supabase
    .from('api_usage')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)

  const { data: keysData } = await supabase
    .from('api_keys')
    .select('id, provider, model_name, daily_limit, daily_used')

  const today = new Date().toISOString().split('T')[0]
  const todayUsage = usageData?.filter((u: any) => 
    u.created_at.startsWith(today)
  ) || []

  const stats = {
    total_calls_today: todayUsage.length,
    successful_calls_today: todayUsage.filter((u: any) => u.success).length,
    total_tokens_today: todayUsage.reduce((sum: number, u: any) => sum + (u.tokens_used || 0), 0),
    keys_status: keysData || [],
    recent_usage: usageData?.slice(0, 50) || [],
  }

  return NextResponse.json({ data: stats })
}
