import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

// Helper function to get and validate JWT secret (called at request time, not module load)
function getSecret() {
  const secretString = process.env.JWT_SECRET || 'formless-secret-change-in-production'

  // Production environment requires a secure JWT secret
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required in production')
  }

  // Validate minimum secret length for security
  if (secretString.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security')
  }

  return new TextEncoder().encode(secretString)
}

export async function createSession(adminId: string, email: string) {
  const secret = getSecret()
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
    const secret = getSecret()
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
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload as { adminId: string; email: string }
  } catch {
    return null
  }
}

export async function verifyAdminSession(request: NextRequest) {
  return getSessionFromRequest(request);
}
