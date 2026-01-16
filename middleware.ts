import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

// 公开路由 - 不需要认证
const isPublicRoute = createRouteMatcher([
  '/',
  '/robots.txt',
  '/sitemap.xml',
  '/auth(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/:locale',
  '/:locale/robots.txt',
  '/:locale/sitemap.xml',
  '/:locale/auth(.*)',
  '/:locale/sign-in(.*)',
  '/:locale/sign-up(.*)',
  '/api/webhook(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return NextResponse.next()
  }

  // Admin 路由跳过国际化，直接处理
  if (pathname.startsWith('/admin')) {
    if (!isPublicRoute(req)) {
      await auth.protect()
    }
    return NextResponse.next()
  }

  // 保护非公开路由
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
  // 运行 i18n 中间件
  return intlMiddleware(req)
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
