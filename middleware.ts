import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)
const localePattern = routing.locales.join('|')
const localeRootRegex = new RegExp(`^/(${localePattern})$`)
const localeRobotsRegex = new RegExp(`^/(${localePattern})/robots\\.txt$`)
const localeSitemapRegex = new RegExp(`^/(${localePattern})/sitemap\\.xml$`)
const localeAuthRegex = new RegExp(`^/(${localePattern})/auth(.*)`)
const localeSignInRegex = new RegExp(`^/(${localePattern})/sign-in(.*)`)
const localeSignUpRegex = new RegExp(`^/(${localePattern})/sign-up(.*)`)

// 公开路由 - 不需要认证
const isPublicRoute = createRouteMatcher([
  '/',
  '/robots.txt',
  '/sitemap.xml',
  '/auth(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  localeRootRegex,
  localeRobotsRegex,
  localeSitemapRegex,
  localeAuthRegex,
  localeSignInRegex,
  localeSignUpRegex,
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

  // API 路由跳过国际化中间件，直接处理认证
  if (pathname.startsWith('/api')) {
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
