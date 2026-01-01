import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseAdminClient } from '@/lib/supabase/server'
import { createSession } from '@/lib/auth/session'
import { Database } from '@/lib/supabase/database.types'
import { LoginSchema } from '@/lib/validation/schemas'

export const runtime = 'edge';

type AdminUser = Database['public']['Tables']['admin_users']['Row']

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const { email, password } = await request.json()

    const validationResult = LoginSchema.safeParse({ email, password })
    if (!validationResult.success) {
      const errors: Record<string, string[]> = {}
      validationResult.error.issues.forEach((err) => {
        const path = err.path.join('.')
        if (!errors[path]) errors[path] = []
        errors[path].push(err.message)
      })
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdminClient()

    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .limit(1)

    const admin = data?.[0] as AdminUser | undefined

    if (error || !admin) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const passwordMatch = await bcrypt.compare(password, admin.password_hash)

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    await createSession(admin.id, admin.email)

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
      },
    })
  } catch (error) {
    // Only log detailed errors in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Login error:', error)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
