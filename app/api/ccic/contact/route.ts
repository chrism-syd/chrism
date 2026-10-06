import { NextResponse } from 'next/server'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'

export const runtime = 'nodejs'

type ContactBody = {
  name?: unknown
  organization?: unknown
  email?: unknown
  phone?: unknown
  message?: unknown
  website?: unknown
  elapsedMs?: unknown
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  let body: ContactBody

  try {
    body = await request.json() as ContactBody
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const name = clean(body.name)
  const organization = clean(body.organization)
  const email = clean(body.email).toLowerCase()
  const phone = clean(body.phone)
  const message = clean(body.message)
  const website = clean(body.website)
  const elapsedMs = typeof body.elapsedMs === 'number' ? body.elapsedMs : 0

  // Quietly accept obvious bot submissions without sending email.
  if (website || (elapsedMs > 0 && elapsedMs < 1200)) {
    return NextResponse.json({ ok: true })
  }

  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
  }

  if (!validEmail(email) || email.length > 254) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  if (organization.length > 160 || phone.length > 40) {
    return NextResponse.json({ error: 'One of the contact fields is too long.' }, { status: 400 })
  }

  if (!message || message.length > 3000) {
    return NextResponse.json({ error: 'Please enter a message.' }, { status: 400 })
  }

  const recipient = process.env.CCIC_CONTACT_EMAIL?.trim() || 'ccic@kofc7689.org'
  const safeName = escapeHtml(name)
  const safeOrganization = escapeHtml(organization)
  const safeEmail = escapeHtml(email)
  const safePhone = escapeHtml(phone)
  const safeMessage = escapeHtml(message).replaceAll('\n', '<br />')

  try {
    await sendBrevoTransactionalEmail({
      to: [{ email: recipient, name: 'CCIC' }],
      subject: `New CCIC contact message from ${name}`,
      replyTo: { email, name },
      textContent: [
        `Name: ${name}`,
        organization ? `Organization: ${organization}` : null,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        '',
        message,
      ].filter((line): line is string => line !== null).join('\n'),
      htmlContent: `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#202020;line-height:1.55;">
          <h1 style="font-size:24px;margin:0 0 20px;">New CCIC contact message</h1>
          <p><strong>Name:</strong> ${safeName}</p>
          ${organization ? `<p><strong>Organization:</strong> ${safeOrganization}</p>` : ''}
          <p><strong>Email:</strong> ${safeEmail}</p>
          ${phone ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ''}
          <hr style="border:0;border-top:1px solid #ddd;margin:24px 0;" />
          <p>${safeMessage}</p>
        </div>
      `,
    })
  } catch (error) {
    console.error('CCIC contact email failed', error)
    return NextResponse.json(
      { error: 'We could not send your message. Please try again.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
