// @ts-nocheck - Supabase type system limitation with dynamic queries
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export async function getAvailableApiKey(provider: 'chutes' | 'openrouter') {
  const supabase = getSupabaseAdminClient()

  const { data: keys } = await supabase
    .from('api_keys')
    .select('*')
    .eq('provider', provider)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (!keys || keys.length === 0) {
    return null
  }

  const availableKey = keys.find((k) => (k.daily_used || 0) < (k.daily_limit || 1000))
  return availableKey || keys[0]
}

// Usage tracking increment is now handled directly in the API routes
// Kept for backwards compatibility
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function incrementApiKeyUsage(_keyId: string) {
  return
}

export async function logApiUsage(params: {
  api_key_id?: string
  provider: string
  model_name?: string
  user_id?: string
  conversation_id?: string
  tokens_used?: number
  success: boolean
  error_message?: string
  response_time_ms?: number
}) {
  const supabase = getSupabaseAdminClient()
  await supabase.from('api_usage').insert([params]).catch(() => {})
}
