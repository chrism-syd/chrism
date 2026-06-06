import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase()
  const isOperationsHost = hostname === 'operations.chrism.app'

  if (isOperationsHost && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/operations'
    const response = await updateSession(request)
    const rewriteResponse = NextResponse.rewrite(url, { request })

    response.cookies.getAll().forEach((cookie) => {
      rewriteResponse.cookies.set(cookie)
    })

    return rewriteResponse
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
