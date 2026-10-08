import 'server-only'
import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { protectPeoplePayload } from '@/lib/security/pii'
import { getCcicSchoolCampaign, isCcicSchoolCampaignOpen } from '@/lib/christmas-cards/schools'
import { calculateCcicSchoolOrder, parseCcicSchoolOrderDraft } from '@/lib/christmas-cards/school-order'
import { getCcicMixedBoxAvailability } from '@/lib/christmas-cards/inventory'

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
  const sourceId = normalize(body.sourceId)
  if (!sourceId || sourceId.length > 300) return NextResponse.json({ error: 'Payment token is missing.' }, { status: 400 })

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

  const admin = createAdminClient()
  const orderId = randomUUID()
  const orderNumber = `CCIC-S-${new Date().getUTCFullYear() % 100}-${orderId.slice(0,8).toUpperCase()}`
  const protectedContact = protectPeoplePayload({ email, cell_phone: phone })
  const protectText = (value: string) => protectPeoplePayload({ address_line_1: value }).address_line_1
  const { error: insertError } = await admin.from('ccic_school_orders').insert({
    id: orderId, order_number: orderNumber, school_slug: school.slug, school_code: school.code, school_name: school.name,
    parent_name: protectText(parentName), email: protectedContact.email, email_hash: protectedContact.email_hash,
    cell_phone: protectedContact.cell_phone, cell_phone_hash: protectedContact.cell_phone_hash,
    student_name: protectText(studentName), grade: protectText(grade), room_number: protectText(roomNumber), teacher_name: protectText(teacherName),
    pii_key_version: process.env.PII_KEY_VERSION || 'v1', subtotal_cents: order.subtotalCents,
    school_contribution_cents: order.schoolContributionCents, total_cents: order.totalCents,
    square_environment: 'sandbox', square_location_id: locationId,
  })
  if (insertError) return NextResponse.json({ error: 'Unable to save your order.' }, { status: 500 })
  const { error: lineError } = await admin.from('ccic_school_order_lines').insert(order.lines.map((line, i) => ({
    order_id: orderId, catalog_id: line.catalogId, sku: line.sku, title: line.title,
    quantity: line.quantity, unit_price_cents: line.unitPriceCents, line_total_cents: line.lineTotalCents, sort_order: i,
  })))
  if (lineError) {
    await admin.from('ccic_school_orders').update({ status_code: 'payment_failed', square_error: 'Unable to save order lines.' }).eq('id', orderId)
    return NextResponse.json({ error: 'Unable to save order items.' }, { status: 500 })
  }

  let payment: Record<string, unknown> = {}
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
    if (!response.ok || !result.payment) throw new Error(result.errors?.[0]?.detail || 'Square declined the payment.')
    payment = result.payment
  } catch (error) {
    await admin.from('ccic_school_orders').update({ status_code: 'payment_failed', square_error: error instanceof Error ? error.message.slice(0, 300) : 'Payment failed.' }).eq('id', orderId)
    return NextResponse.json({ error: 'Payment could not be completed. Please check your card and try again.' }, { status: 402 })
  }
  const paymentStatus = normalize(payment.status)
  const { error: updateError } = await admin.from('ccic_school_orders').update({
    status_code: paymentStatus === 'COMPLETED' ? 'paid' : 'pending_payment',
    square_payment_id: normalize(payment.id), square_payment_status: paymentStatus,
    square_receipt_url: normalize(payment.receipt_url) || null,
    paid_at: paymentStatus === 'COMPLETED' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', orderId)
  if (updateError) return NextResponse.json({ error: 'Payment was submitted, but confirmation is delayed. Contact us before retrying.', orderNumber }, { status: 502 })
  if (paymentStatus !== 'COMPLETED') return NextResponse.json({ error: 'Payment is still processing. Please contact us before retrying.', orderNumber }, { status: 202 })

  for (const line of order.lines) {
    const { error } = await admin.rpc('ccic_commit_mixed_boxes', { p_catalog_id: line.catalogId, p_quantity: line.quantity })
    if (error) {
      console.error('School inventory commitment requires reconciliation', { orderId, catalogId: line.catalogId, error: error.message })
      return NextResponse.json({ error: 'Payment succeeded, but inventory reconciliation is pending. Please do not pay again.', orderNumber }, { status: 202 })
    }
  }
  return NextResponse.json({ paid: true, orderNumber, totalCents: order.totalCents })
}
