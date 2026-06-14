import { NextRequest, NextResponse } from 'next/server'

const FLASH_MESSAGE_COOKIE = 'chrism_flash_message'

type FlashKind = 'notice' | 'error'

type FlashMessage = {
  kind: FlashKind
  message: string
}

const MESSAGE_QUERY_KEYS = ['notice', 'error'] as const

function getFlashMessage(request: NextRequest): FlashMessage | null {
  const notice = request.nextUrl.searchParams.get('notice')?.trim()
  if (notice) {
    return { kind: 'notice', message: notice }
  }

  const error = request.nextUrl.searchParams.get('error')?.trim()
  if (error) {
    return { kind: 'error', message: error }
  }

  return null
}

function shouldIgnorePath(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  )
}

export function middleware(request: NextRequest) {
  if (shouldIgnorePath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const flash = getFlashMessage(request)
  if (!flash) {
    return NextResponse.next()
  }

  const cleanUrl = request.nextUrl.clone()
  for (const key of MESSAGE_QUERY_KEYS) {
    cleanUrl.searchParams.delete(key)
  }

  const response = NextResponse.redirect(cleanUrl)
  response.cookies.set(FLASH_MESSAGE_COOKIE, encodeURIComponent(JSON.stringify(flash)), {
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
