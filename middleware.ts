import { NextRequest, NextResponse } from 'next/server'

const COUNCIL_SETTINGS_FLASH_COOKIE = 'chrism_council_settings_flash'

type FlashKind = 'notice' | 'error'

function getFlashMessage(request: NextRequest): { kind: FlashKind; message: string } | null {
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

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== '/me/council') {
    return NextResponse.next()
  }

  const flash = getFlashMessage(request)
  if (!flash) {
    return NextResponse.next()
  }

  const cleanUrl = request.nextUrl.clone()
  cleanUrl.searchParams.delete('notice')
  cleanUrl.searchParams.delete('error')

  const response = NextResponse.redirect(cleanUrl)
  response.cookies.set(COUNCIL_SETTINGS_FLASH_COOKIE, JSON.stringify(flash), {
    maxAge: 60,
    path: '/me/council',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}

export const config = {
  matcher: ['/me/council'],
}
