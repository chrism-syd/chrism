import { NextResponse, type NextRequest } from 'next/server'
import { getCcicCanadaPostRates, selectCcicShippingRate } from '@/lib/christmas-cards/canada-post'

export const runtime = 'nodejs'

// Provisional full-case parcel profile. Replace with measured packed dimensions
// and weight once the finished CCIC cards and shipping cartons are in hand.
const PROVISIONAL_FULL_CASE = {
  weightKg: 6.5,
  lengthCm: 45.7,
  widthCm: 30.5,
  heightCm: 12.7,
}

function normalizePostalCode(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function POST(request: NextRequest) {
  let body: { postalCode?: unknown; totalBoxes?: unknown }

  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'The shipping request was not valid.' }, { status: 400 })
  }

  const postalCode = normalizePostalCode(body.postalCode)
  if (!/^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTVWXYZ][0-9][ABCEGHJ-NPRSTVWXYZ][0-9]$/.test(postalCode)) {
    return NextResponse.json({ error: 'Enter a valid Canadian postal code.' }, { status: 400 })
  }

  const totalBoxes = typeof body.totalBoxes === 'number' && Number.isFinite(body.totalBoxes)
    ? Math.max(1, Math.floor(body.totalBoxes))
    : 1

  // Until physical samples arrive, rate one provisional full case only for
  // orders up to 32 boxes. Larger orders deliberately fall back to manual
  // shipping review rather than presenting a fabricated live price.
  if (totalBoxes > 32) {
    return NextResponse.json({
      available: false,
      provisional: true,
      reason: 'packing_required',
      message: 'Shipping will be confirmed after we review the best packing option for this order.',
    })
  }

  try {
    const rates = await getCcicCanadaPostRates({
      destinationPostalCode: postalCode,
      parcel: PROVISIONAL_FULL_CASE,
    })
    const selected = selectCcicShippingRate(rates)

    if (!selected) {
      return NextResponse.json({
        available: false,
        provisional: true,
        message: 'A live Canada Post rate is not available for this postal code right now.',
      })
    }

    return NextResponse.json({
      available: true,
      provisional: true,
      rate: selected,
      rates,
      parcel: PROVISIONAL_FULL_CASE,
    })
  } catch (error) {
    console.error('CCIC Canada Post rating failed', error)
    return NextResponse.json({
      available: false,
      provisional: true,
      message: 'We could not retrieve a live Canada Post rate right now. Shipping can still be reviewed with your order.',
    })
  }
}
