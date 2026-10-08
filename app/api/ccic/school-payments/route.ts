import 'server-only'
import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { protectPeoplePayload } from '@/lib/security/pii'
import { getCcicSchoolCampaign, isCcicSchoolCampaignOpen } from '@/lib/christmas-cards/schools'
import { calculateCcicSchoolOrder, parseCcicSchoolOrderDraft } from '@/lib/christmas-cards/school-order'
import { getCcicMixedBoxAvailability } from '@/lib/christmas-cards/inventory'
import { finalizeCcicSchoolPayment, sendCcicSchoolOrderConfirmation } from '@/lib/christmas-cards/school-payment-finalize'

export const runtime = 'nodejs'

const normalize = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export async function POST(request: NextRequest) {
  if (process.env.SQUARE_ENVIRONMENT !== 'sandbox') return NextResponse.json({ error: 'School payments are not enabled.' }, { status: 503 })
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  const locationId = process.env.SQUARE_LOCATION_ID
  if (!accessToken || !locationId || !process.env.PII_ENCRYPTION_KEY) return NextResponse.json({ error: 'Payment configuration is incomplete.' }, { status: 503 })

  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const draft = parseCcicSchoolOrderDraft(body.draft)
  const school = draft && getCcicSchoolCampaign(draft.schoolSlug)
  if (!draft || !school || draft.schoolCode !== school.code || !isCcicSchoolCampaignOpen(school)) return NextResponse.json({ error: 'This school fundraiser is unavailable or closed.' }, { status: 400 })
  const order = calculateCcicSchoolOrder(draft)
  if (!order.hasOrder || order.totalBoxes > 99) return NextResponse.json({ error: 'Invalid cart.' }, { status: 400 })

  const details = body.details && typeof body.details === 'object' && !Array.isArray(body.details) ? body.details as Record<string, unknown> : {}
  const parentName = normalize(details.parentName)
  const email = normalize(details.email).toLowerCase()
  const phone = normalize(details.phone)
  const studentName = normalize(details.studentName)
  const grade = normalize(details.grade)
  const roomNumber = normalize(details.roomNumber)
  const teacherName = normalize(details.teacherName)
  if (!parentName || !/^\S+@\S+\.\S+$/.test(email) || !studentName || !grade || !roomNumber || !teacherName ||
      [parentName,email,phone,studentName,grade,roomNumber,teacherName].some((v) => v.length > 200)) {
    return NextResponse.json({ error: 'Please complete all required checkout fields.' }, { status: 400 })
  }
  const checkoutKey = normalize(body.checkoutKey)
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(checkoutKey)) return NextResponse.json({ error: 'Checkout session is invalid. Please refresh the page.' }, { status: 400 })
  const sourceId = normalize(body.sourceId)
  if (!sourceId || sourceId.length > 300) return NextResponse.json({ error: 'Payment token is missing.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin.from('ccic_school_orders')
    .select('id,order_number,status_code,total_cents,school_code,square_payment_id')
    .eq('checkout_key', checkoutKey).maybeSingle()
  if (existingError) return NextResponse.json({ error: 'Unable to check your previous payment attempt. Please do not retry yet.' }, { status: 503 })
  if (existing) {
    if (existing.school_code !== school.code || existing.total_cents !== order.totalCents) {
      return NextResponse.json({ error: 'Your checkout has changed. Please reload the page before paying.' }, { status: 409 })
    }
    if (existing.status_code === 'paid') return NextResponse.json({ paid: true, orderNumber: existing.order_number, totalCents: existing.total_cents })
    return NextResponse.json({
      error: 'This checkout has already been submitted. Please contact CCIC with your order number before trying again.',
      orderNumber: existing.order_number,
    }, { status: 409 })
  }

  let available
  try {
    available = await getCcicMixedBoxAvailability()
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 300))
    try {
      available = await getCcicMixedBoxAvailability()
    } catch (error) {
      console.error('School payment inventory check unavailable', error)
      return NextResponse.json(
        { error: 'We could not verify card availability right now. Your card has not been charged. Please try again in a moment.' },
        { status: 503 }
      )
    }
  }

  for (const line of order.lines) {
    const capacity = available.find((item) => item.mixedCatalogId === line.catalogId)?.additionalMixedBoxesAvailable
    if (capacity !== null && capacity !== undefined && line.quantity > capacity) return NextResponse.json({ error: 'One of your selections is no longer available.' }, { status: 409 })
  }

  const orderId = randomUUID()
  const orderNumber = `CCIC-S-${new Date().getUTCFullYear() % 100}-${orderId.slice(0,8).toUpperCase()}`
  const protectedContact = protectPeoplePayload({ email, cell_phone: phone })
  const protectText = (value: string) => protectPeoplePayload({ address_line_1: value }).address_line_1
  const { error: insertError } = await admin.from('ccic_school_orders').insert({
    id: orderId, checkout_key: checkoutKey, order_number: orderNumber, school_slug: school.slug, school_code: school.code, school_name: school.name,
    parent_name: protectText(parentName), email: protectedContact.email, email_hash: protectedContact.email_hash,
    cell_phone: protectedContact.cell_phone, cell_phone_hash: protectedContact.cell_phone_hash,
    student_name: protectText(studentName), grade: protectText(grade), room_number: protectText(roomNumber), teacher_name: protectText(teacherName),
    pii_key_version: process.env.PII_KEY_VERSION || 'v1', subtotal_cents: order.subtotalCents,
    school_contribution_cents: order.schoolContributionCents, total_cents: order.totalCents,
    square_environment: 'sandbox', square_location_id: locationId,
  })
  if (insertError) return NextResponse.json({ error: 'Unable to save your order. Please refresh and check before retrying.' }, { status: 503 })
  const { error: lineError } = await admin.from('ccic_school_order_lines').insert(order.lines.map((line, i) => ({
    order_id: orderId, catalog_id: line.catalogId, sku: line.sku, title: line.title,
    quantity: line.quantity, unit_price_cents: line.unitPriceCents, line_total_cents: line.lineTotalCents, sort_order: i,
  })))
  if (lineError) {
    await admin.from('ccic_school_orders').update({ status_code: 'payment_failed', square_error: 'Unable to save order lines.' }).eq('id', orderId)
    return NextResponse.json({ error: 'Unable to save order items.' }, { status: 500 })
  }

  let payment: Record<string, unknown> = {}
  let squareResponseReceived = false
  try {
    const response = await fetch('https://connect.squareupsandbox.com/v2/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Square-Version': '2026-01-22' },
      body: JSON.stringify({
        source_id: sourceId, idempotency_key: orderId, location_id: locationId,
        amount_money: { amount: order.totalCents, currency: 'CAD' },
        reference_id: orderId, note: `CCIC school fundraiser ${orderNumber}`, autocomplete: true,
      }),
      cache: 'no-store',
    })
    const result = await response.json() as { payment?: Record<string, unknown>; errors?: Array<{ detail?: string }> }
    squareResponseReceived = true
    if (!response.ok || !result.payment) {
      await admin.from('ccic_school_orders').update({
        status_code: 'payment_failed',
        square_error: result.errors?.[0]?.detail?.slice(0,300) || 'Square declined payment',
      }).eq('id', orderId)
      return NextResponse.json({ error: 'Payment was declined. No charge was completed. Please start a new checkout attempt.', orderNumber }, { status: 402 })
    }
    payment = result.payment
  } catch (error) {
    // A network timeout does not prove Square failed to charge the card.
    // Leave the order pending so a verified webhook or manual reconciliation can resolve it.
    console.error('Square school payment outcome unknown', { orderId, error })
    return NextResponse.json({
      error: 'Payment status could not be confirmed. Please do not retry. Contact CCIC with this order number.',
      orderNumber,
    }, { status: 202 })
  }
  if (!squareResponseReceived || payment.status !== 'COMPLETED') {
    await admin.from('ccic_school_orders').update({
      square_payment_id: normalize(payment.id) || null,
      square_payment_status: normalize(payment.status) || 'UNKNOWN',
    }).eq('id', orderId)
    return NextResponse.json({ error: 'Payment is processing. Please do not retry until CCIC confirms the status.', orderNumber }, { status: 202 })
  }

  try {
    const result = await finalizeCcicSchoolPayment(orderId, payment)
    await sendCcicSchoolOrderConfirmation(orderId)
    return NextResponse.json({ paid: true, ...result })
  } catch (error) {
    console.error('Square payment completed but CCIC finalization failed', { orderId, error })
    return NextResponse.json({
      error: 'Square payment completed, but order reconciliation is pending. Please do not pay again.',
      orderNumber,
    }, { status: 202 })
  }
}
