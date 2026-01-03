import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from './database.types'

type CookieStore = ReturnType<typeof cookies>

export function createClientWithCookies(cookieStore: CookieStore) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore cookie set errors in server contexts
          }
        },
      },
    }
  )
}

export async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  return createClientWithCookies(cookieStore)
}

export function getSupabaseAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: 'public'
      }
    }
  )
}

// Backwards-compatible helper used by API routes
export function createClient(cookieStore: CookieStore) {
  return createClientWithCookies(cookieStore)
}
