import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ACTIVE_ACCESS_CONTEXT_COOKIE } from '@/lib/auth/super-admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'

export async function POST(request: Request) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { contextKey?: string | null }
  const nextContextKey = typeof body.contextKey === 'string' ? body.contextKey.trim() : ''
  const cookieStore = await cookies()

  if (!nextContextKey) {
    cookieStore.delete(ACTIVE_ACCESS_CONTEXT_COOKIE)
    return NextResponse.json({ ok: true })
  }

  const isAllowed = permissions.availableContexts.some((context) => context.key === nextContextKey)
  if (!isAllowed) {
    return NextResponse.json({ error: 'Invalid access context' }, { status: 400 })
  }

  cookieStore.set(ACTIVE_ACCESS_CONTEXT_COOKIE, nextContextKey, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
