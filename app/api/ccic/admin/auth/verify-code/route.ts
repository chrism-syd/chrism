import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCcicOrderAdminEmail } from '@/lib/christmas-cards/admin'
import {
  CCIC_ADMIN_MAX_CODE_ATTEMPTS,
  CCIC_ADMIN_SESSION_COOKIE,
  CCIC_ADMIN_SESSION_MAX_AGE_SECONDS,
  ccicAdminSessionExpiry,
  generateCcicAdminSessionToken,
  hashCcicAdminCode,
  hashCcicAdminEmail,
  hashCcicAdminSessionToken,
  normalizeCcicAdminEmail,
} from '@/lib/christmas-cards/admin-auth'

export const runtime = 'nodejs'

type LoginCodeRow = {
  id: string
  code_hash: string
  attempts: number
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export async function POST(request: NextRequest) {
  let email = ''
  let code = ''

  try {
    const body = await request.json() as { email?: unknown; code?: unknown }
    email = normalizeCcicAdminEmail(typeof body.email === 'string' ? body.email : '')
    code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : ''
  } catch {
    return NextResponse.json({ error: 'The login request was not valid.' }, { status: 400 })
  }

  if (!email || code.length !== 6) {
    return NextResponse.json({ error: 'Enter the six-digit code from your email.' }, { status: 400 })
  }

  try {
    if (!isCcicOrderAdminEmail(email)) {
      return NextResponse.json({ error: 'This email address is not authorized for CCIC order access.' }, { status: 403 })
    }
  } catch (error) {
    console.error('CCIC admin allowlist is not configured', error)
    return NextResponse.json({ error: 'CCIC admin access is not configured yet.' }, { status: 503 })
  }

  const admin = createAdminClient()
  const emailHash = hashCcicAdminEmail(email)
  const { data, error } = await admin
    .from('ccic_admin_login_codes')
    .select('id, code_hash, attempts')
    .eq('email_hash', emailHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const loginCode = data as LoginCodeRow | null
  if (error || !loginCode) {
    return NextResponse.json({ error: 'That code has expired or is no longer valid. Request a new code.' }, { status: 400 })
  }

  if (loginCode.attempts >= CCIC_ADMIN_MAX_CODE_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many attempts. Request a new login code.' }, { status: 429 })
  }

  const expectedHash = hashCcicAdminCode(email, code)
  if (!hashesMatch(expectedHash, loginCode.code_hash)) {
    await admin
      .from('ccic_admin_login_codes')
      .update({ attempts: loginCode.attempts + 1 })
      .eq('id', loginCode.id)

    return NextResponse.json({ error: 'That code was not accepted. Check the code and try again.' }, { status: 400 })
  }

  const usedAt = new Date().toISOString()
  await admin
    .from('ccic_admin_login_codes')
    .update({ used_at: usedAt })
    .eq('id', loginCode.id)

  const sessionToken = generateCcicAdminSessionToken()
  const { error: sessionError } = await admin
    .from('ccic_admin_sessions')
    .insert({
      email_hash: emailHash,
      token_hash: hashCcicAdminSessionToken(sessionToken),
      expires_at: ccicAdminSessionExpiry(),
    })

  if (sessionError) {
    console.error('CCIC admin session insert failed', sessionError)
    return NextResponse.json({ error: 'We could not start your session. Please request a new code.' }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(CCIC_ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/ccic/admin',
    maxAge: CCIC_ADMIN_SESSION_MAX_AGE_SECONDS,
  })

  return response
}
