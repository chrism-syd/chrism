import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { protectPeoplePayload } from '@/lib/security/pii'
import { calculateCcicOrder, parseCcicOrderDraftInput } from '@/lib/christmas-cards/order'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const id = body.id
  const contact = body.contact as Record<string, unknown> | null
  const draft = parseCcicOrderDraftInput(body.draft)
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      !contact || typeof contact !== 'object' || !draft || draft.fulfillmentMethod !== 'shipping') {
    return NextResponse.json({ error: 'Invalid checkout' }, { status: 400 })
  }

  const name = typeof contact.contactName === 'string' ? contact.contactName.trim().slice(0, 160) : ''
  const email = typeof contact.email === 'string' ? contact.email.trim().slice(0, 254) : ''
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ saved: false })

  const calculated = calculateCcicOrder(draft)
  if (!calculated.hasOrder) return NextResponse.json({ saved: false })
  const organization = typeof contact.organizationName === 'string' ? contact.organizationName.trim().slice(0, 160) : ''
  const phone = typeof contact.phone === 'string' ? contact.phone.trim().slice(0, 60) : ''
  const shippingStatus = body.shippingStatus === 'priced' ? 'priced' : body.shippingStatus === 'pending' ? 'pending' : 'waiting'
  const quotedShipping = body.shippingCents
  const shippingCents = shippingStatus === 'priced' && typeof quotedShipping === 'number' && Number.isSafeInteger(quotedShipping) && quotedShipping >= 0 && quotedShipping < 10000000 ? quotedShipping : null
  const protectedContact = protectPeoplePayload({ email, cell_phone: phone })
  const admin = createAdminClient()
  const { data: existing, error: lookupError } = await admin.from('ccic_abandoned_checkouts').select('status').eq('id', id).maybeSingle()
  if (lookupError) return NextResponse.json({ saved: false }, { status: 503 })
  if (existing?.status === 'completed') return NextResponse.json({ saved: true })

  const values = {
    contact_name: name,
    organization_name: organization,
    ...protectedContact,
    cart_lines: calculated.lines.map(line => ({ title: line.title, quantity: line.quantity, line_total_cents: line.lineTotalCents })),
    subtotal_cents: calculated.subtotalCents,
    shipping_cents: shippingCents,
    shipping_status: shippingStatus,
    total_cents: calculated.subtotalCents + (shippingCents ?? 0),
    last_activity_at: new Date().toISOString(),
  }
  const { error } = existing
    ? await admin.from('ccic_abandoned_checkouts').update(values).eq('id', id).eq('status', 'active')
    : await admin.from('ccic_abandoned_checkouts').insert({ id, ...values })
  if (error) return NextResponse.json({ saved: false }, { status: 503 })
  return NextResponse.json({ saved: true })
}
