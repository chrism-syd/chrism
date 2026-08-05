import { NextResponse, type NextRequest } from 'next/server'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'
import { createAdminClient } from '@/lib/supabase/admin'
import { protectPeoplePayload } from '@/lib/security/pii'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
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

type RequestBody = {
  draft?: unknown
  contact?: ContactInput
}

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

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableString(value: unknown) {
  const normalized = normalizeString(value)
  return normalized || null
}

function validateContact(contact: ContactInput | undefined, draft: CcicOrderDraftInput): ValidatedContact {
  const contactName = normalizeString(contact?.contactName)
  const organizationName = normalizeString(contact?.organizationName)
  const email = normalizeString(contact?.email).toLowerCase()
  const phone = normalizeString(contact?.phone)
  const addressLine1 = nullableString(contact?.addressLine1)
  const addressLine2 = nullableString(contact?.addressLine2)
  const city = nullableString(contact?.city)
  const province = nullableString(contact?.province)
  const postalCode = nullableString(contact?.postalCode)

  if (!contactName) throw new Error('Please enter your name.')
  if (!organizationName) throw new Error('Please enter your organization name.')
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email address.')
  if (!phone) throw new Error('Please enter a phone number.')

  if (draft.fulfillmentMethod === 'shipping') {
    if (!addressLine1 || !city || !province || !postalCode) {
      throw new Error('A complete shipping address is required when shipping is selected.')
    }
  }

  return {
    contactName,
    organizationName,
    email,
    phone,
    addressLine1,
    addressLine2,
    city,
    province,
    postalCode,
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function makeOrderNumber() {
  const year = new Date().getUTCFullYear()
  const token = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
  return `CCIC-${year}-${token}`
}

function buildAddress(contact: ValidatedContact) {
  return [
    contact.addressLine1,
    contact.addressLine2,
    [contact.city, contact.province].filter(Boolean).join(', '),
    contact.postalCode,
  ].filter(Boolean).join('\n')
}

function buildOrderEmail(args: {
  orderNumber: string
  contact: ValidatedContact
  draft: CcicOrderDraftInput
}) {
  const calculated = calculateCcicOrder(args.draft)
  const lineRowsHtml = calculated.lines.map((line) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e5e5;">${escapeHtml(`${line.quantity} × ${line.title}`)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e5e5;text-align:right;white-space:nowrap;">${escapeHtml(formatChristmasCardMoney(line.lineTotalCents))}</td>
    </tr>
  `).join('')
  const lineRowsText = calculated.lines
    .map((line) => `${line.quantity} x ${line.title}: ${formatChristmasCardMoney(line.lineTotalCents)}`)
    .join('\n')
  const address = buildAddress(args.contact)
  const fulfillmentLabel = args.draft.fulfillmentMethod === 'shipping' ? 'Shipping' : 'Pickup'
  const discountHtml = calculated.customCaseDiscountCents
    ? `<tr><td style="padding:8px 0;color:#1d6b3a;">Custom Case pricing</td><td style="padding:8px 0;text-align:right;color:#1d6b3a;">−${escapeHtml(formatChristmasCardMoney(calculated.customCaseDiscountCents))}</td></tr>`
    : ''
  const discountText = calculated.customCaseDiscountCents
    ? `\nCustom Case pricing: -${formatChristmasCardMoney(calculated.customCaseDiscountCents)}`
    : ''

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;color:#202020;line-height:1.55;max-width:680px;margin:0 auto;">
      <h1 style="font-size:28px;margin:0 0 8px;">CCIC order request received</h1>
      <p style="margin:0 0 22px;">Order <strong>${escapeHtml(args.orderNumber)}</strong></p>
      <p>Thank you, ${escapeHtml(args.contact.contactName)}. We received the Christmas card order request for <strong>${escapeHtml(args.contact.organizationName)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:22px 0;">
        ${lineRowsHtml}
        ${discountHtml}
        <tr><td style="padding:10px 0 4px;">Subtotal</td><td style="padding:10px 0 4px;text-align:right;">${escapeHtml(formatChristmasCardMoney(calculated.subtotalCents))}</td></tr>
        <tr><td style="padding:4px 0;">${fulfillmentLabel}</td><td style="padding:4px 0;text-align:right;">${escapeHtml(formatChristmasCardMoney(calculated.shippingCents))}</td></tr>
        <tr><td style="padding:12px 0;border-top:1px solid #202020;font-weight:bold;">Estimated total</td><td style="padding:12px 0;border-top:1px solid #202020;text-align:right;font-weight:bold;">${escapeHtml(formatChristmasCardMoney(calculated.totalCents))}</td></tr>
      </table>
      <p><strong>Fulfilment:</strong> ${fulfillmentLabel}</p>
      ${address ? `<p><strong>Address:</strong><br>${escapeHtml(address).replaceAll('\n', '<br>')}</p>` : ''}
      <p>No payment has been collected. We will review the order and follow up with confirmation and payment instructions.</p>
    </div>
  `

  const textContent = [
    'CCIC order request received',
    `Order ${args.orderNumber}`,
    '',
    `Organization: ${args.contact.organizationName}`,
    `Contact: ${args.contact.contactName}`,
    `Email: ${args.contact.email}`,
    `Phone: ${args.contact.phone}`,
    '',
    lineRowsText,
    discountText,
    '',
    `Subtotal: ${formatChristmasCardMoney(calculated.subtotalCents)}`,
    `${fulfillmentLabel}: ${formatChristmasCardMoney(calculated.shippingCents)}`,
    `Estimated total: ${formatChristmasCardMoney(calculated.totalCents)}`,
    address ? `Address:\n${address}` : '',
    '',
    'No payment has been collected. The order will be reviewed before final confirmation.',
  ].filter(Boolean).join('\n')

  return { htmlContent, textContent, calculated }
}

function getAdminNotificationRecipients() {
  const configuredEmails = (process.env.CCIC_ORDER_NOTIFICATION_EMAIL || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^\S+@\S+\.\S+$/.test(email))

  const uniqueEmails = [...new Set(configuredEmails)]
  if (uniqueEmails.length) {
    return uniqueEmails.map((email) => ({ email, name: 'CCIC Orders' }))
  }

  const fallbackEmail = process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase() || ''
  return /^\S+@\S+\.\S+$/.test(fallbackEmail)
    ? [{ email: fallbackEmail, name: 'CCIC Orders' }]
    : []
}

export async function POST(request: NextRequest) {
  let body: RequestBody

  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'The order request was not valid.' }, { status: 400 })
  }

  const draft = parseCcicOrderDraftInput(body.draft)
  if (!draft) {
    return NextResponse.json({ error: 'Your order could not be read. Please return to the card selection page.' }, { status: 400 })
  }

  const calculated = calculateCcicOrder(draft)
  if (!calculated.hasOrder || !calculated.lines.length) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })
  }

  let contact: ValidatedContact
  try {
    contact = validateContact(body.contact, draft)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Please review your contact information.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const orderNumber = makeOrderNumber()
  const protectedContact = protectPeoplePayload({
    email: contact.email,
    cell_phone: contact.phone,
    address_line_1: contact.addressLine1,
    address_line_2: contact.addressLine2,
    city: contact.city,
    state_province: contact.province,
    postal_code: contact.postalCode,
    country_code: 'CA',
  })

  const { data: order, error: orderError } = await admin
    .from('ccic_orders')
    .insert({
      order_number: orderNumber,
      status_code: 'new',
      contact_name: contact.contactName,
      organization_name: contact.organizationName,
      ...protectedContact,
      fulfillment_method: draft.fulfillmentMethod,
      regular_subtotal_cents: calculated.regularSubtotalCents,
      custom_case_count: calculated.customCaseCount,
      custom_case_discount_cents: calculated.customCaseDiscountCents,
      subtotal_cents: calculated.subtotalCents,
      shipping_cents: calculated.shippingCents,
      total_cents: calculated.totalCents,
      currency_code: 'CAD',
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    console.error('CCIC order insert failed', orderError)
    return NextResponse.json({ error: 'We could not save your order. Please try again.' }, { status: 500 })
  }

  const { error: lineError } = await admin.from('ccic_order_lines').insert(
    calculated.lines.map((line, index) => ({
      order_id: order.id,
      line_type: line.lineType,
      catalog_id: line.catalogId,
      sku: line.sku,
      title: line.title,
      quantity: line.quantity,
      unit_price_cents: line.unitPriceCents,
      line_total_cents: line.lineTotalCents,
      boxes_per_unit: line.boxesPerUnit,
      sort_order: index,
    }))
  )

  if (lineError) {
    console.error('CCIC order line insert failed', lineError)
    await admin.from('ccic_orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'We could not save the items in your order. Please try again.' }, { status: 500 })
  }

  const email = buildOrderEmail({ orderNumber: order.order_number, contact, draft })
  const adminRecipients = getAdminNotificationRecipients()

  const emailResults = await Promise.allSettled([
    sendBrevoTransactionalEmail({
      to: [{ email: contact.email, name: contact.contactName }],
      subject: `CCIC order request ${order.order_number}`,
      htmlContent: email.htmlContent,
      textContent: email.textContent,
    }),
    adminRecipients.length
      ? sendBrevoTransactionalEmail({
          to: adminRecipients,
          subject: `New CCIC order ${order.order_number} from ${contact.organizationName}`,
          htmlContent: email.htmlContent,
          textContent: email.textContent,
          replyTo: { email: contact.email, name: contact.contactName },
        })
      : Promise.reject(new Error('Missing CCIC_ORDER_NOTIFICATION_EMAIL')),
  ])

  const confirmationEmailSent = emailResults[0].status === 'fulfilled'
  const adminEmailSent = emailResults[1].status === 'fulfilled'
  const emailErrors = emailResults
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason))

  await admin
    .from('ccic_orders')
    .update({
      confirmation_email_sent_at: confirmationEmailSent ? new Date().toISOString() : null,
      admin_email_sent_at: adminEmailSent ? new Date().toISOString() : null,
      email_error: emailErrors.length ? emailErrors.join(' | ').slice(0, 2000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  return NextResponse.json({
    orderNumber: order.order_number,
    confirmationEmailSent,
  }, { status: 201 })
}
