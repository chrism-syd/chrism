import { NextResponse, type NextRequest } from 'next/server'
import { isCcicOrderAdminEmail } from '@/lib/christmas-cards/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let email = ''

  try {
    const body = await request.json() as { email?: unknown }
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  let allowed = false

  try {
    allowed = isCcicOrderAdminEmail(email)
  } catch (error) {
    console.error('CCIC admin allowlist is not configured', error)
    return NextResponse.json({ error: 'CCIC admin access is not configured yet.' }, { status: 503 })
  }

  if (!allowed) {
    return NextResponse.json({ error: 'This email address is not authorized for CCIC order access.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${request.nextUrl.origin}/auth/confirm?next=${encodeURIComponent('/ccic/admin/orders')}`,
    },
  })

  if (error) {
    console.error('CCIC admin code request failed', error)
    return NextResponse.json({ error: 'We could not send a login code. Please try again shortly.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
