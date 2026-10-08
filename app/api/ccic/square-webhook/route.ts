import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { finalizeCcicSchoolPayment, sendCcicSchoolOrderConfirmation } from '@/lib/christmas-cards/school-payment-finalize'

export const runtime = 'nodejs'

type SquareWebhook = {
  event_id?: string
  type?: string
  data?: { object?: { payment?: { id?: string; reference_id?: string } } }
}

export async function POST(request: NextRequest) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL
  if (!signatureKey || !notificationUrl || process.env.SQUARE_ENVIRONMENT !== 'sandbox') {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 })
  }
  const body = await request.text()
  const supplied = request.headers.get('x-square-hmacsha256-signature') || ''
  const expected = createHmac('sha256', signatureKey).update(notificationUrl + body).digest('base64')
  const suppliedBytes = Buffer.from(supplied)
  const expectedBytes = Buffer.from(expected)
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 403 })
  }

  let event: SquareWebhook
  try { event = JSON.parse(body) as SquareWebhook }
  catch { return NextResponse.json({ error: 'Invalid event.' }, { status: 400 }) }
  if (!event.event_id || !event.type) return NextResponse.json({ error: 'Missing event identity.' }, { status: 400 })
  if (!['payment.created', 'payment.updated'].includes(event.type)) return NextResponse.json({ ok: true })

  const paymentId = event.data?.object?.payment?.id
  if (!paymentId) return NextResponse.json({ error: 'Missing payment ID.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: previous } = await admin.from('ccic_square_webhook_events')
    .select('processed_at').eq('event_id', event.event_id).maybeSingle()
  if (previous?.processed_at) return NextResponse.json({ ok: true, duplicate: true })

  const { error: eventError } = await admin.from('ccic_square_webhook_events')
    .upsert({ event_id: event.event_id, event_type: event.type, square_payment_id: paymentId },
      { onConflict: 'event_id', ignoreDuplicates: true })
  if (eventError) return NextResponse.json({ error: 'Unable to record webhook.' }, { status: 503 })

  try {
    const response = await fetch(`https://connect.squareupsandbox.com/v2/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, 'Square-Version': '2026-01-22' },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Square payment lookup HTTP ${response.status}`)
    const result = await response.json() as { payment?: {
      id?: string; status?: string; reference_id?: string; location_id?: string;
      amount_money?: { amount?: number; currency?: string }; receipt_url?: string; created_at?: string
    } }
    const payment = result.payment
    if (!payment?.reference_id) throw new Error('Square payment has no CCIC reference.')
    const { data: order, error: orderError } = await admin.from('ccic_school_orders')
      .select('id,status_code').eq('id', payment.reference_id).maybeSingle()
    if (orderError) throw new Error(orderError.message)
    if (!order) {
      // Other Square transactions do not belong to the school fundraiser.
      await admin.from('ccic_square_webhook_events').update({ processed_at: new Date().toISOString() }).eq('event_id', event.event_id)
      return NextResponse.json({ ok: true, unrelated: true })
    }
    if (payment.status === 'COMPLETED') {
      await finalizeCcicSchoolPayment(order.id, payment)
      await sendCcicSchoolOrderConfirmation(order.id)
    } else if (payment.status === 'FAILED' || payment.status === 'CANCELED') {
      if (order.status_code !== 'paid') {
        await admin.from('ccic_school_orders').update({
          status_code: 'payment_failed', square_payment_id: payment.id,
          square_payment_status: payment.status, updated_at: new Date().toISOString(),
        }).eq('id', order.id)
      }
    }
    const { error: processedError } = await admin.from('ccic_square_webhook_events')
      .update({ processed_at: new Date().toISOString(), processing_error: null }).eq('event_id', event.event_id)
    if (processedError) throw new Error(processedError.message)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook failure'
    console.error('CCIC Square webhook reconciliation failed', { eventId: event.event_id, error: message })
    await admin.from('ccic_square_webhook_events').update({ processing_error: message.slice(0,400) }).eq('event_id', event.event_id)
    return NextResponse.json({ error: 'Reconciliation temporarily unavailable.' }, { status: 503 })
  }
}
