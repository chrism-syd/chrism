import { updateSession } from './lib/supabase/proxy'
import { NextResponse, type NextRequest } from 'next/server'

const CCIC_HOSTS = new Set(['ccic.supplies', 'www.ccic.supplies'])
const CCIC_ROUTE_PREFIX = '/ccic'
const PUBLIC_FILE_PATTERN = /\.[^/]+$/

function getRequestHost(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(':')[0]
    .trim()
    .toLowerCase()
}

function getCleanCcicPath(pathname: string) {
  const cleanPath = pathname.slice(CCIC_ROUTE_PREFIX.length)
  return cleanPath || '/'
}

export async function proxy(request: NextRequest) {
  const host = getRequestHost(request)
  const pathname = request.nextUrl.pathname

  if (CCIC_HOSTS.has(host)) {
    // Keep old or hardcoded /ccic URLs working, but expose the clean storefront path.
    if (pathname === CCIC_ROUTE_PREFIX || pathname.startsWith(`${CCIC_ROUTE_PREFIX}/`)) {
      const cleanUrl = request.nextUrl.clone()
      cleanUrl.pathname = getCleanCcicPath(pathname)

      return NextResponse.redirect(cleanUrl, 308)
    }

    // API routes and public files already live at their root paths.
    if (!pathname.startsWith('/api/') && !PUBLIC_FILE_PATTERN.test(pathname)) {
      const ccicUrl = request.nextUrl.clone()
      ccicUrl.pathname = pathname === '/' ? CCIC_ROUTE_PREFIX : `${CCIC_ROUTE_PREFIX}${pathname}`

      return NextResponse.rewrite(ccicUrl)
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
