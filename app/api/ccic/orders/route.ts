import { randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'
import { createAdminClient } from '@/lib/supabase/admin'
import { protectPeoplePayload } from '@/lib/security/pii'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import { allocateCcicOrderInventory } from '@/lib/christmas-cards/inventory'
import { CCIC_MANUAL_SHIPPING_MESSAGE, quoteCcicShipping } from '@/lib/christmas-cards/canada-post'
import {
  calculateCcicOrder,
  parseCcicOrderDraftInput,
  type CcicOrderDraftInput,
} from '@/lib/christmas-cards/order'

export const runtime = 'nodejs'

type ContactInput = {
  contactName?: unknown
  organizationName?: unknown
  email?: unknown
  phone?: unknown
  addressLine1?: unknown
  addressLine2?: unknown
  city?: unknown
  province?: unknown
  postalCode?: unknown
}

type RequestBody = { draft?: unknown; contact?: ContactInput }

type ValidatedContact = {
  contactName: string
  organizationName: string
  email: string
  phone: string
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  province: string | null
  postalCode: string | null
}

type ShippingResult = {
  status: 'pickup' | 'priced' | 'pending'
  shippingCents: number
  provider: string | null
  serviceCode: string | null
  serviceName: string | null
  transitDays: number | null
}

function normalizeString(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function nullableString(value: unknown) { const normalized = normalizeString(value); return normalized || null }

function validateContact(contact: ContactInput | undefined, draft: CcicOrderDraftInput): ValidatedContact {
  const contactName = normalizeString(contact?.contactName)
  const organizationName = normalizeString(contact?.organizationName)
  const email = normalizeString(contact?.email).toLowerCase()
  const phone = normalizeString(contact?.phone)
  const addressLine1 = nullableString(contact?.addressLine1)
  const addressLine2 = nullableString(contact?.addressLine2)
  const city = nullableString(contact?.city)
  const rawProvince = nullableString(contact?.province)
  const postalCode = nullableString(contact?.postalCode)
  const hasPickupAddressDetails = Boolean(addressLine1 || addressLine2 || city || postalCode)
  const province = draft.fulfillmentMethod === 'pickup' && !hasPickupAddressDetails ? null : rawProvince

  if (!contactName) throw new Error('Please enter your name.')
  if (!organizationName) throw new Error('Please enter your organization name.')
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email address.')
  if (!phone) throw new Error('Please enter a phone number.')
  if (draft.fulfillmentMethod === 'shipping' && (!addressLine1 || !city || !province || !postalCode)) throw new Error('A complete shipping address is required when shipping is selected.')
  return { contactName, organizationName, email, phone, addressLine1, addressLine2, city, province, postalCode }
}

function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;') }
function makeOrderNumber() { const year = String(new Date().getUTCFullYear()).slice(-2); const token = randomInt(0, 10000).toString().padStart(4, '0'); return `CCIC-${year}-${token}` }
function buildAddress(contact: ValidatedContact) { return [contact.addressLine1, contact.addressLine2, [contact.city, contact.province].filter(Boolean).join(', '), contact.postalCode].filter(Boolean).join('\n') }

function buildOrderEmail(args: { orderNumber: string; contact: ValidatedContact; draft: CcicOrderDraftInput; shipping: ShippingResult }) {
  const calculated = calculateCcicOrder(args.draft)
  const totalCents = calculated.subtotalCents + args.shipping.shippingCents
  const totalLabel = formatChristmasCardMoney(totalCents)
  const shippingPending = args.shipping.status === 'pending'
  const fulfillmentLabel = args.draft.fulfillmentMethod === 'shipping' ? 'Shipping' : 'Pickup'
  const shippingLabel = args.shipping.status === 'priced' ? formatChristmasCardMoney(args.shipping.shippingCents) : args.shipping.status === 'pending' ? 'To be calculated' : formatChristmasCardMoney(0)
  const totalHeading = shippingPending ? 'Current subtotal' : 'Total'
  const address = buildAddress(args.contact)
  const lineRowsHtml = calculated.lines.map((line) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e5e5;">${escapeHtml(`${line.quantity} × ${line.title}`)}</td><td style="padding:8px 0;border-bottom:1px solid #e5e5e5;text-align:right;white-space:nowrap;">${escapeHtml(formatChristmasCardMoney(line.lineTotalCents))}</td></tr>`).join('')
  const lineRowsText = calculated.lines.map((line) => `${line.quantity} x ${line.title}: ${formatChristmasCardMoney(line.lineTotalCents)}`).join('\n')
  const discountHtml = calculated.customCaseDiscountCents ? `<tr><td style="padding:8px 0;color:#1d6b3a;">Custom Case pricing</td><td style="padding:8px 0;text-align:right;color:#1d6b3a;">−${escapeHtml(formatChristmasCardMoney(calculated.customCaseDiscountCents))}</td></tr>` : ''
  const discountText = calculated.customCaseDiscountCents ? `\nCustom Case pricing: -${formatChristmasCardMoney(calculated.customCaseDiscountCents)}` : ''
  const paymentHtml = shippingPending ? `<p><strong>Payment:</strong> Please wait for our email confirming the shipping cost and final total before sending payment.</p>` : `<p><strong>E-transfer payment:</strong> Please send an e-transfer for <strong>${escapeHtml(totalLabel)}</strong> to treasurer@kofc7689.org and include your order number <strong>${escapeHtml(args.orderNumber)}</strong> in the e-transfer message.</p><p><strong>Cheque payment:</strong><br><strong>Make cheque payable to:</strong><br>Knights of Columbus #7689<br><br><strong>Mail to:</strong><br>Kerry Mendonca, CCIC<br>37 White Ash Drive<br>Markham, ON L3P 4N1<br><br>Please include your order number <strong>${escapeHtml(args.orderNumber)}</strong> in the memo field.</p>`
  const paymentText = shippingPending ? 'Payment: Please wait for our email confirming the shipping cost and final total before sending payment.' : `E-transfer payment: Please send an e-transfer for ${totalLabel} to treasurer@kofc7689.org and include your order number ${args.orderNumber} in the e-transfer message.\n\nCheque payment:\nMake cheque payable to:\nKnights of Columbus #7689\n\nMail to:\nKerry Mendonca, CCIC\n37 White Ash Drive\nMarkham, ON L3P 4N1\n\nPlease include your order number ${args.orderNumber} in the memo field.`
  const thankYouMessage = 'Thank you for supporting the charitable efforts of the Knights of Columbus, and for helping ensure that Jesus remains the reason we celebrate the season of Christmas.'
  const serviceDetail = args.shipping.serviceName ? `${args.shipping.serviceName}${args.shipping.transitDays !== null ? `, estimated ${args.shipping.transitDays} business day${args.shipping.transitDays === 1 ? '' : 's'}` : ''}` : null

  const htmlContent = `<div style="font-family:Arial,sans-serif;color:#202020;line-height:1.55;max-width:680px;margin:0 auto;"><div style="margin:0 0 18px;"><img src="https://chrismworks.com/CCiC.png" alt="CCIC" width="120" style="display:block;width:120px;max-width:100%;height:auto;border:0;" /></div><h1 style="font-size:28px;margin:0 0 8px;">CCIC order request received</h1><p style="margin:0 0 22px;">Order <strong>${escapeHtml(args.orderNumber)}</strong></p><p>Thank you, ${escapeHtml(args.contact.contactName)}. We received the Christmas card order request for <strong>${escapeHtml(args.contact.organizationName)}</strong>.</p><div style="margin:22px 0;padding:16px;border:1px solid #e5e5e5;background:#fafafa;"><p style="margin:0 0 8px;font-weight:bold;">Contact details</p><p style="margin:0;"><strong>Name:</strong> ${escapeHtml(args.contact.contactName)}</p><p style="margin:0;"><strong>Organization:</strong> ${escapeHtml(args.contact.organizationName)}</p><p style="margin:0;"><strong>Email:</strong> <a href="mailto:${escapeHtml(args.contact.email)}">${escapeHtml(args.contact.email)}</a></p><p style="margin:0;"><strong>Phone:</strong> ${escapeHtml(args.contact.phone)}</p>${address ? `<p style="margin:8px 0 0;"><strong>Shipping address:</strong><br>${escapeHtml(address).replaceAll('\n', '<br>')}</p>` : ''}</div><table style="width:100%;border-collapse:collapse;margin:22px 0;">${lineRowsHtml}${discountHtml}<tr><td style="padding:10px 0 4px;">Subtotal</td><td style="padding:10px 0 4px;text-align:right;">${escapeHtml(formatChristmasCardMoney(calculated.subtotalCents))}</td></tr><tr><td style="padding:4px 0;">${fulfillmentLabel}</td><td style="padding:4px 0;text-align:right;">${escapeHtml(shippingLabel)}</td></tr><tr><td style="padding:12px 0;border-top:1px solid #202020;font-weight:bold;">${totalHeading}</td><td style="padding:12px 0;border-top:1px solid #202020;text-align:right;font-weight:bold;">${escapeHtml(totalLabel)}</td></tr></table>${shippingPending ? `<p><strong>Shipping is not yet priced.</strong> ${escapeHtml(CCIC_MANUAL_SHIPPING_MESSAGE)}</p>` : ''}<p><strong>Fulfilment:</strong> ${fulfillmentLabel}${serviceDetail ? ` (${escapeHtml(serviceDetail)})` : ''}</p>${paymentHtml}<p style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e5e5;">${escapeHtml(thankYouMessage)}</p></div>`
  const textContent = ['CCIC order request received', `Order ${args.orderNumber}`, '', `Organization: ${args.contact.organizationName}`, `Contact: ${args.contact.contactName}`, `Email: ${args.contact.email}`, `Phone: ${args.contact.phone}`, '', lineRowsText, discountText, '', `Subtotal: ${formatChristmasCardMoney(calculated.subtotalCents)}`, `${fulfillmentLabel}: ${shippingLabel}`, `${totalHeading}: ${totalLabel}`, serviceDetail ? `Service: ${serviceDetail}` : '', shippingPending ? `Shipping is not yet priced. ${CCIC_MANUAL_SHIPPING_MESSAGE}` : '', address ? `Address:\n${address}` : '', '', paymentText, '', thankYouMessage].filter(Boolean).join('\n')
  return { htmlContent, textContent }
}

function getAdminNotificationRecipients() {
  const configuredEmails = (process.env.CCIC_ORDER_NOTIFICATION_EMAIL || '').split(',').map((email) => email.trim().toLowerCase()).filter((email) => /^\S+@\S+\.\S+$/.test(email))
  const uniqueEmails = [...new Set(configuredEmails)]
  if (uniqueEmails.length) return uniqueEmails.map((email) => ({ email, name: 'CCIC Orders' }))
  const fallbackEmail = process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase() || ''
  return /^\S+@\S+\.\S+$/.test(fallbackEmail) ? [{ email: fallbackEmail, name: 'CCIC Orders' }] : []
}

export async function POST(request: NextRequest) {
  let body: RequestBody
  try { body = await request.json() as RequestBody } catch { return NextResponse.json({ error: 'The order request was not valid.' }, { status: 400 }) }
  const draft = parseCcicOrderDraftInput(body.draft)
  if (!draft) return NextResponse.json({ error: 'Your order could not be read. Please return to the card selection page.' }, { status: 400 })
  const calculated = calculateCcicOrder(draft)
  if (!calculated.hasOrder || !calculated.lines.length) return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })

  let contact: ValidatedContact
  try { contact = validateContact(body.contact, draft) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Please review your contact information.' }, { status: 400 }) }

  let shipping: ShippingResult = { status: 'pickup', shippingCents: 0, provider: null, serviceCode: null, serviceName: null, transitDays: null }
  if (draft.fulfillmentMethod === 'shipping' && contact.addressLine1 && contact.city && contact.province && contact.postalCode) {
    const quote = await quoteCcicShipping({
      destination: { addressLine1: contact.addressLine1, city: contact.city, province: contact.province, postalCode: contact.postalCode },
      totalBoxes: calculated.totalSelectedBoxes,
    })
    shipping = quote.status === 'priced'
      ? { status: 'priced', shippingCents: quote.rate.amountCents, provider: 'shiptime', serviceCode: quote.rate.serviceCode, serviceName: quote.rate.serviceName, transitDays: quote.rate.expectedTransitTime }
      : { status: 'pending', shippingCents: 0, provider: null, serviceCode: null, serviceName: null, transitDays: null }
  }
  const totalCents = calculated.subtotalCents + shipping.shippingCents
  const admin = createAdminClient()
  const protectedContact = protectPeoplePayload({ email: contact.email, cell_phone: contact.phone, address_line_1: contact.addressLine1, address_line_2: contact.addressLine2, city: contact.city, state_province: contact.province, postal_code: contact.postalCode, country_code: 'CA' })

  let order: { id: string; order_number: string } | null = null
  let lastOrderError: unknown = null
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const orderNumber = makeOrderNumber()
    const { data, error } = await admin.from('ccic_orders').insert({
      order_number: orderNumber, status_code: 'received', contact_name: contact.contactName, organization_name: contact.organizationName, ...protectedContact,
      fulfillment_method: draft.fulfillmentMethod, regular_subtotal_cents: calculated.regularSubtotalCents, custom_case_count: calculated.customCaseCount,
      custom_case_discount_cents: calculated.customCaseDiscountCents, subtotal_cents: calculated.subtotalCents, shipping_cents: shipping.shippingCents, total_cents: totalCents, currency_code: 'CAD',
      shipping_status: shipping.status, shipping_provider: shipping.provider, shipping_service_code: shipping.serviceCode, shipping_service_name: shipping.serviceName,
      shipping_transit_days: shipping.transitDays, shipping_quoted_at: shipping.status === 'priced' ? new Date().toISOString() : null,
    }).select('id, order_number').single()
    if (!error && data) { order = data; break }
    lastOrderError = error
    if (error?.code !== '23505') break
  }
  if (!order) { console.error('CCIC order insert failed', lastOrderError); return NextResponse.json({ error: 'We could not save your order. Please try again.' }, { status: 500 }) }

  const { error: lineError } = await admin.from('ccic_order_lines').insert(calculated.lines.map((line, index) => ({ order_id: order.id, line_type: line.lineType, catalog_id: line.catalogId, sku: line.sku, title: line.title, quantity: line.quantity, unit_price_cents: line.unitPriceCents, line_total_cents: line.lineTotalCents, boxes_per_unit: line.boxesPerUnit, sort_order: index })))
  if (lineError) { console.error('CCIC order line insert failed', lineError); await admin.from('ccic_orders').delete().eq('id', order.id); return NextResponse.json({ error: 'We could not save the items in your order. Please try again.' }, { status: 500 }) }

  try { await allocateCcicOrderInventory(order.id, calculated) } catch (error) {
    console.error('CCIC inventory allocation failed', error); await admin.from('ccic_orders').delete().eq('id', order.id)
    const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : ''
    const customerMessage = message.includes('no longer available') || message.includes('not have enough inventory') ? message : 'We could not reserve the selected cards. Please refresh the store and review the available quantities.'
    return NextResponse.json({ error: customerMessage }, { status: 409 })
  }

  const email = buildOrderEmail({ orderNumber: order.order_number, contact, draft, shipping })
  const adminRecipients = getAdminNotificationRecipients()
  const emailResults = await Promise.allSettled([
    sendBrevoTransactionalEmail({ to: [{ email: contact.email, name: contact.contactName }], subject: `CCIC order request ${order.order_number}`, htmlContent: email.htmlContent, textContent: email.textContent }),
    adminRecipients.length ? sendBrevoTransactionalEmail({ to: adminRecipients, subject: `New CCIC order ${order.order_number} from ${contact.organizationName}`, htmlContent: email.htmlContent, textContent: email.textContent, replyTo: { email: contact.email, name: contact.contactName } }) : Promise.reject(new Error('Missing CCIC_ORDER_NOTIFICATION_EMAIL')),
  ])
  const confirmationEmailSent = emailResults[0].status === 'fulfilled'
  const adminEmailSent = emailResults[1].status === 'fulfilled'
  const emailErrors = emailResults.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason))
  await admin.from('ccic_orders').update({ confirmation_email_sent_at: confirmationEmailSent ? new Date().toISOString() : null, admin_email_sent_at: adminEmailSent ? new Date().toISOString() : null, email_error: emailErrors.length ? emailErrors.join(' | ').slice(0, 2000) : null, updated_at: new Date().toISOString() }).eq('id', order.id)
  revalidatePath('/ccic'); revalidatePath('/ccic/admin/store-control')
  return NextResponse.json({ orderNumber: order.order_number, confirmationEmailSent, shippingStatus: shipping.status, shippingCents: shipping.shippingCents, shippingServiceCode: shipping.serviceCode, shippingServiceName: shipping.serviceName, shippingTransitDays: shipping.transitDays, totalCents }, { status: 201 })
}
