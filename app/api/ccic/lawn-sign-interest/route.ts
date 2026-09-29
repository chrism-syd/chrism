import { NextResponse, type NextRequest } from 'next/server'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'

export const runtime = 'nodejs'

type RequestBody = {
  contactName?: unknown
  organizationName?: unknown
  email?: unknown
  phone?: unknown
  sets?: unknown
}

type ValidatedRequest = {
  contactName: string
  organizationName: string
  email: string
  phone: string
  sets: number
}

const PRICE_PER_SET_CENTS = 15000

function normalizeString(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;') }

function validateRequest(body: RequestBody): ValidatedRequest {
  const contactName = normalizeString(body.contactName)
  const organizationName = normalizeString(body.organizationName)
  const email = normalizeString(body.email).toLowerCase()
  const phone = normalizeString(body.phone)
  const sets = typeof body.sets === 'number' && Number.isInteger(body.sets) ? body.sets : 0

  if (!contactName || contactName.length > 120) throw new Error('Please enter your name.')
  if (!organizationName || organizationName.length > 160) throw new Error('Please enter your council or organization.')
  if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email address.')
  if (!phone || phone.length > 40) throw new Error('Please enter a phone number.')
  if (sets < 1 || sets > 10) throw new Error('Please choose between 1 and 10 sets.')
  return { contactName, organizationName, email, phone, sets }
}

function adminRecipients() {
  const configured = (process.env.CCIC_ORDER_NOTIFICATION_EMAIL || '').split(',').map((email) => email.trim().toLowerCase()).filter((email) => /^\S+@\S+\.\S+$/.test(email))
  const unique = [...new Set(configured)]
  if (unique.length) return unique.map((email) => ({ email, name: 'CCIC Lawn Signs' }))
  const fallback = process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase() || ''
  return /^\S+@\S+\.\S+$/.test(fallback) ? [{ email: fallback, name: 'CCIC Lawn Signs' }] : []
}

function buildEmail(request: ValidatedRequest) {
  const signs = request.sets * 10
  const total = request.sets * PRICE_PER_SET_CENTS
  const totalLabel = `$${(total / 100).toFixed(2)} CAD`
  const quantityLabel = `${request.sets} set${request.sets === 1 ? '' : 's'} of 10 (${signs} signs)`
  const htmlContent = `<div style="font-family:Arial,sans-serif;color:#202020;line-height:1.55;max-width:680px;margin:0 auto;"><div style="margin:0 0 18px;"><img src="https://chrismworks.com/CCiC.png" alt="CCIC" width="120" style="display:block;width:120px;max-width:100%;height:auto;border:0;" /></div><p style="margin:0 0 8px;color:#8a4d13;font-size:12px;font-weight:bold;letter-spacing:.12em;text-transform:uppercase;">Printed on demand</p><h1 style="font-size:28px;margin:0 0 18px;">CCIC lawn sign request received</h1><p>Thank you, ${escapeHtml(request.contactName)}. We've received your interest in CCIC lawn signs for <strong>${escapeHtml(request.organizationName)}</strong>.</p><div style="margin:22px 0;padding:16px;border:1px solid #e5e5e5;background:#fafafa;"><p style="margin:0 0 8px;"><strong>Requested:</strong> ${escapeHtml(quantityLabel)}</p><p style="margin:0;"><strong>Estimated total:</strong> ${escapeHtml(totalLabel)}</p><p style="margin:8px 0 0;"><strong>Pickup:</strong> Markham only</p></div><p>Lawn signs are printed on demand and include an H-stake. We'll follow up by email to confirm availability, timing, pickup, and payment.</p><p style="margin-top:26px;">Thank you for helping keep Jesus the reason we celebrate the season of Christmas.</p></div>`
  const textContent = ['CCIC lawn sign request received', '', `Name: ${request.contactName}`, `Council / organization: ${request.organizationName}`, `Email: ${request.email}`, `Phone: ${request.phone}`, `Requested: ${quantityLabel}`, `Estimated total: ${totalLabel}`, 'Pickup: Markham only', '', 'Lawn signs are printed on demand and include an H-stake. We will follow up by email to confirm availability, timing, pickup, and payment.'].join('\n')
  return { htmlContent, textContent, quantityLabel, totalLabel }
}

export async function POST(request: NextRequest) {
  let body: RequestBody
  try { body = await request.json() as RequestBody } catch { return NextResponse.json({ error: 'The lawn sign request was not valid.' }, { status: 400 }) }

  let interest: ValidatedRequest
  try { interest = validateRequest(body) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Please review your information.' }, { status: 400 }) }

  const email = buildEmail(interest)
  const recipients = adminRecipients()
  if (!recipients.length) {
    console.error('CCIC lawn sign request missing notification recipient')
    return NextResponse.json({ error: 'We could not send your request. Please try again later.' }, { status: 500 })
  }

  const adminHtml = email.htmlContent.replace('</div>', `<div style="margin:22px 0;padding:16px;border:1px solid #e5e5e5;"><p style="margin:0;"><strong>Contact:</strong> ${escapeHtml(interest.contactName)}<br><strong>Organization:</strong> ${escapeHtml(interest.organizationName)}<br><strong>Email:</strong> ${escapeHtml(interest.email)}<br><strong>Phone:</strong> ${escapeHtml(interest.phone)}</p></div></div>`)

  const results = await Promise.allSettled([
    sendBrevoTransactionalEmail({ to: [{ email: interest.email, name: interest.contactName }], subject: 'CCIC lawn sign request received', htmlContent: email.htmlContent, textContent: email.textContent }),
    sendBrevoTransactionalEmail({ to: recipients, subject: `New CCIC lawn sign request from ${interest.organizationName}`, htmlContent: adminHtml, textContent: email.textContent, replyTo: { email: interest.email, name: interest.contactName } }),
  ])

  if (results[1].status === 'rejected') {
    console.error('CCIC lawn sign admin email failed', results[1].reason)
    return NextResponse.json({ error: 'We could not send your request. Please try again later.' }, { status: 502 })
  }
  if (results[0].status === 'rejected') console.error('CCIC lawn sign customer confirmation failed', results[0].reason)

  return NextResponse.json({ sent: true, confirmationEmailSent: results[0].status === 'fulfilled' }, { status: 200 })
}
