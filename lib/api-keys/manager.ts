// @ts-nocheck - Supabase type system limitation with dynamic queries
import { getSupabaseAdminClient } from '@/lib/supabase/server'

export async function getAvailableApiKey(provider: 'chutes' | 'openrouter') {
  const supabase = getSupabaseAdminClient()

  // Get current date for daily reset check
  const today = new Date().toISOString().split('T')[0]

  const { data: keys } = await supabase
    .from('api_keys')
    .select('*')
    .eq('provider', provider)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (!keys || keys.length === 0) {
    return null
  }

  // Find first key with available daily quota
  for (const key of keys) {
    // Reset daily_used if it's a new day
    const keyDate = key.reset_at ? key.reset_at.split('T')[0] : null
    if (keyDate !== today) {
      await supabase
        .from('api_keys')
        .update({ daily_used: 0, reset_at: new Date().toISOString() })
        .eq('id', key.id)
      key.daily_used = 0
    }

    if ((key.daily_used || 0) < (key.daily_limit || 1000)) {
      return key
    }
  }

  return keys[0] // Return first key even if over limit
}

export async function incrementApiKeyUsage(keyId: string, tokens: number = 1) {
  if (!keyId) return

  const supabase = getSupabaseAdminClient()
  await supabase
    .from('api_keys')
    .update({
      daily_used: supabase.rpc('increment', { amount: tokens, row_id: keyId }),
      last_used_at: new Date().toISOString(),
    })
    .eq('id', keyId)
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
