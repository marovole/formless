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

  return (data as any)?.[0]?.content || null
}
