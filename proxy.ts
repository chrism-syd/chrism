import { updateSession } from './lib/supabase/proxy'
import { NextResponse, type NextRequest } from 'next/server'

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

export async function proxy(request: NextRequest) {
  const host = getRequestHost(request)

  if (host === 'ccic.supplies' && request.nextUrl.pathname === '/') {
    const storefrontUrl = request.nextUrl.clone()
    storefrontUrl.pathname = '/ccic'

    return NextResponse.rewrite(storefrontUrl)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
