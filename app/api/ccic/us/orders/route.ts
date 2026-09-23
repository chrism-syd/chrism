import { randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'
import { protectPeoplePayload } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatUsChristmasCardMoney } from '@/lib/christmas-cards/us/catalog'
import { allocateCcicUsOrderInventory } from '@/lib/christmas-cards/us/inventory'
import { calculateCcicUsOrder, parseCcicUsOrderDraftInput } from '@/lib/christmas-cards/us/order'
import { CCIC_US_HANDLING_CENTS, ccicUsQuotePromiseCopy } from '@/lib/christmas-cards/us/confirmation'

export const runtime = 'nodejs'

type ContactInput = {
  contactName?: unknown
  organizationName?: unknown
  email?: unknown
  phone?: unknown
  addressLine1?: unknown
  addressLine2?: unknown
  city?: unknown
  state?: unknown
  postalCode?: unknown
}

function txt(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function nullable(value: unknown) { const v = txt(value); return v || null }
function escapeHtml(value: string) { return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;") }
function orderNumber() { return `CCIC-US-${String(new Date().getUTCFullYear()).slice(-2)}-${randomInt(0,10000).toString().padStart(4,'0')}` }

export async function POST(request: NextRequest) {
  let body: { draft?: unknown; contact?: ContactInput }
  try { body = await request.json() as typeof body } catch { return NextResponse.json({ error: 'The order request was not valid.' }, { status: 400 }) }

  const draft = parseCcicUsOrderDraftInput(body.draft)
  if (!draft) return NextResponse.json({ error: 'Your U.S. cart could not be read.' }, { status: 400 })
  const calculated = calculateCcicUsOrder(draft)
  if (!calculated.hasOrder || !calculated.lines.length) return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })

  const contactName = txt(body.contact?.contactName)
  const organizationName = txt(body.contact?.organizationName)
  const email = txt(body.contact?.email).toLowerCase()
  const phone = txt(body.contact?.phone)
  const addressLine1 = txt(body.contact?.addressLine1)
  const addressLine2 = nullable(body.contact?.addressLine2)
  const city = txt(body.contact?.city)
  const state = txt(body.contact?.state).toUpperCase()
  const postalCode = txt(body.contact?.postalCode)

  if (!contactName) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
  if (!organizationName) return NextResponse.json({ error: 'Please enter your council or organization name.' }, { status: 400 })
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'Please enter a phone number.' }, { status: 400 })
  if (!addressLine1 || !city || !/^[A-Z]{2}$/.test(state) || !/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    return NextResponse.json({ error: 'Please enter a complete U.S. shipping address.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const protectedContact = protectPeoplePayload({
    email, cell_phone: phone, address_line_1: addressLine1, address_line_2: addressLine2,
    city, state_province: state, postal_code: postalCode, country_code: 'US',
  })
  const currentTotal = calculated.subtotalCents + CCIC_US_HANDLING_CENTS

  let order: { id: string; order_number: string } | null = null
  let lastError: unknown = null
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const number = orderNumber()
    const { data, error } = await admin.from('ccic_orders').insert({
      order_number: number,
      status_code: 'received',
      market_code: 'US',
      us_confirmation_status: 'awaiting_shipping_quote',
      contact_name: contactName,
      organization_name: organizationName,
      ...protectedContact,
      fulfillment_method: 'shipping',
      regular_subtotal_cents: calculated.regularSubtotalCents,
      custom_case_count: calculated.customCaseCount,
      custom_case_discount_cents: calculated.customCaseDiscountCents,
      subtotal_cents: calculated.subtotalCents,
      shipping_cents: 0,
      us_import_cents: 0,
      us_handling_cents: CCIC_US_HANDLING_CENTS,
      us_processing_fee_cents: 0,
      total_cents: currentTotal,
      currency_code: 'USD',
      shipping_status: 'pending',
      shipping_provider: null,
      shipping_service_code: null,
      shipping_service_name: null,
      shipping_transit_days: null,
      shipping_quoted_at: null,
    }).select('id, order_number').single()
    if (!error && data) { order = data; break }
    lastError = error
    if (error?.code !== '23505') break
  }

  if (!order) {
    console.error('CCIC U.S. order insert failed', lastError)
    return NextResponse.json({ error: 'We could not save your order request. Please try again.' }, { status: 500 })
  }

  const { error: lineError } = await admin.from('ccic_order_lines').insert(calculated.lines.map((line, index) => ({
    order_id: order!.id, line_type: line.lineType, catalog_id: line.catalogId, sku: line.sku, title: line.title,
    quantity: line.quantity, unit_price_cents: line.unitPriceCents, line_total_cents: line.lineTotalCents,
    boxes_per_unit: line.boxesPerUnit, sort_order: index,
  })))
  if (lineError) {
    await admin.from('ccic_orders').delete().eq('id', order.id)
    console.error('CCIC U.S. order line insert failed', lineError)
    return NextResponse.json({ error: 'We could not save the items in your order. Please try again.' }, { status: 500 })
  }

  try {
    await allocateCcicUsOrderInventory(order.id, calculated)
  } catch (error) {
    await admin.from('ccic_orders').delete().eq('id', order.id)
    console.error('CCIC U.S. inventory reservation failed', error)
    return NextResponse.json({ error: 'We could not reserve the selected cards. Please refresh the store and review availability.' }, { status: 409 })
  }

  const promise = ccicUsQuotePromiseCopy()
  const rows = calculated.lines.map(line => `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e5e5;">${escapeHtml(`${line.quantity} × ${line.title}`)}</td><td style="padding:8px 0;border-bottom:1px solid #e5e5e5;text-align:right;">${escapeHtml(formatUsChristmasCardMoney(line.lineTotalCents))}</td></tr>`).join('')
  const html = `<div style="font-family:Arial,sans-serif;color:#202020;line-height:1.55;max-width:680px;margin:0 auto;"><img src="https://chrismworks.com/CCiC.png" alt="CCIC" width="120" style="display:block;width:120px;height:auto;margin-bottom:18px;"><h1 style="font-size:28px;margin:0 0 8px;">We received your U.S. order request</h1><p>Order <strong>${escapeHtml(order.order_number)}</strong></p><p>Thank you, ${escapeHtml(contactName)}. Your cards are reserved while we calculate the final shipping and import costs.</p><p><strong>What happens next:</strong> ${escapeHtml(promise)}</p><table style="width:100%;border-collapse:collapse;margin:22px 0;">${rows}<tr><td style="padding:10px 0;">Merchandise</td><td style="text-align:right;">${formatUsChristmasCardMoney(calculated.subtotalCents)}</td></tr><tr><td style="padding:4px 0;">Handling</td><td style="text-align:right;">${formatUsChristmasCardMoney(CCIC_US_HANDLING_CENTS)}</td></tr><tr><td style="padding:4px 0;">Shipping &amp; import</td><td style="text-align:right;">To be calculated</td></tr><tr><td style="padding:12px 0;border-top:1px solid #202020;font-weight:bold;">Current subtotal</td><td style="padding:12px 0;border-top:1px solid #202020;text-align:right;font-weight:bold;">${formatUsChristmasCardMoney(currentTotal)}</td></tr></table><p>Please do not send payment yet. Your order is not final until you approve the shipping/import amount from the follow-up email.</p></div>`
  const text = `We received your U.S. order request\nOrder ${order.order_number}\n\n${promise}\n\nMerchandise: ${formatUsChristmasCardMoney(calculated.subtotalCents)}\nHandling: ${formatUsChristmasCardMoney(CCIC_US_HANDLING_CENTS)}\nShipping & import: To be calculated\nCurrent subtotal: ${formatUsChristmasCardMoney(currentTotal)}\n\nPlease do not send payment yet.`

  const recipients = (process.env.CCIC_ORDER_NOTIFICATION_EMAIL || '').split(',').map(v => v.trim()).filter(v => /^\S+@\S+\.\S+$/.test(v))
  const results = await Promise.allSettled([
    sendBrevoTransactionalEmail({ to: [{ email, name: contactName }], subject: `CCIC order request ${order.order_number}`, htmlContent: html, textContent: text }),
    recipients.length ? sendBrevoTransactionalEmail({ to: recipients.map(email => ({ email, name: 'CCIC Orders' })), subject: `New CCIC order ${order.order_number} from ${organizationName}`, htmlContent: html, textContent: text, replyTo: { email, name: contactName } }) : Promise.reject(new Error('Missing CCIC_ORDER_NOTIFICATION_EMAIL')),
  ])
  const confirmationEmailSent = results[0].status === 'fulfilled'
  const adminEmailSent = results[1].status === 'fulfilled'
  const emailErrors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason instanceof Error ? r.reason.message : String(r.reason))
  await admin.from('ccic_orders').update({
    confirmation_email_sent_at: confirmationEmailSent ? new Date().toISOString() : null,
    admin_email_sent_at: adminEmailSent ? new Date().toISOString() : null,
    email_error: emailErrors.length ? emailErrors.join(' | ').slice(0, 2000) : null,
    updated_at: new Date().toISOString(),
  }).eq('id', order.id)

  revalidatePath('/ccic/us')
  revalidatePath('/ccic/admin/orders')
  revalidatePath('/ccic/admin/store-control')
  return NextResponse.json({ orderNumber: order.order_number, confirmationEmailSent }, { status: 201 })
}
