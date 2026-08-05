import { NextResponse, type NextRequest } from 'next/server'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCcicOrderAdminEmail } from '@/lib/christmas-cards/admin'
import {
  ccicAdminCodeExpiry,
  generateCcicAdminCode,
  hashCcicAdminCode,
  hashCcicAdminEmail,
  normalizeCcicAdminEmail,
} from '@/lib/christmas-cards/admin-auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let email = ''

  try {
    const body = await request.json() as { email?: unknown }
    email = normalizeCcicAdminEmail(typeof body.email === 'string' ? body.email : '')
  } catch {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
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
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const { data: recentCode } = await admin
    .from('ccic_admin_login_codes')
    .select('created_at')
    .eq('email_hash', emailHash)
    .gte('created_at', oneMinuteAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentCode) {
    return NextResponse.json({ error: 'A code was sent recently. Please wait a minute before requesting another.' }, { status: 429 })
  }

  const code = generateCcicAdminCode()
  const { data: loginCode, error: insertError } = await admin
    .from('ccic_admin_login_codes')
    .insert({
      email_hash: emailHash,
      code_hash: hashCcicAdminCode(email, code),
      expires_at: ccicAdminCodeExpiry(),
    })
    .select('id')
    .single()

  if (insertError || !loginCode) {
    console.error('CCIC admin code insert failed', insertError)
    return NextResponse.json({ error: 'We could not create a login code. Please try again shortly.' }, { status: 500 })
  }

  try {
    await sendBrevoTransactionalEmail({
      to: [{ email }],
      subject: 'Your CCIC order administration login code',
      htmlContent: `
        <div style="font-family:Arial,sans-serif;color:#202020;line-height:1.55;max-width:560px;margin:0 auto;">
          <h1 style="font-size:26px;margin:0 0 12px;">Your one-time login code</h1>
          <p>Use this code to access the private CCIC order administration page:</p>
          <p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:24px 0;">${code}</p>
          <p>This code expires in 10 minutes and grants access only to the CCIC order area.</p>
        </div>
      `,
      textContent: `Your CCIC order administration login code is ${code}. It expires in 10 minutes and grants access only to the CCIC order area.`,
    })
  } catch (error) {
    await admin.from('ccic_admin_login_codes').delete().eq('id', loginCode.id)
    console.error('CCIC admin login email failed', error)
    return NextResponse.json({ error: 'We could not send the login code. Please try again shortly.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
