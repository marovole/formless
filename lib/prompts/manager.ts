// @ts-nocheck - Supabase type system limitation with dynamic queries
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export async function getActivePrompt(
  role: 'formless_elder' | 'memory_extractor' | 'system',
  language: 'zh' | 'en'
) {
  const supabase = getSupabaseAdminClient()

  const { data } = await supabase
    .from('prompts')
    .select('content')
    .eq('role', role)
    .eq('language', language)
    .eq('is_active', true)
    .limit(1)

  return data?.[0]?.content || null
}
