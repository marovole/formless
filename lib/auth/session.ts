import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'formless-secret-change-in-production'
)

export async function createSession(adminId: string, email: string) {
  const token = await new SignJWT({ adminId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set('admin-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return token
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin-session')?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as { adminId: string; email: string }
  } catch {
    return null
  }
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('admin-session')
}

export async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get('admin-session')?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as { adminId: string; email: string }
  } catch {
    return null
  }
}

export async function verifyAdminSession(request: NextRequest) {
  return getSessionFromRequest(request);
}
