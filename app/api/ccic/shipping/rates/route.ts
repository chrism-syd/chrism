import { NextResponse, type NextRequest } from 'next/server'
import { quoteCcicShipping } from '@/lib/christmas-cards/canada-post'

export const runtime = 'nodejs'

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

  const quote = await quoteCcicShipping({ destinationPostalCode: postalCode, totalBoxes })
  if (quote.status === 'pending') {
    return NextResponse.json({
      available: false,
      provisional: quote.provisional,
      reason: quote.reason,
      message: quote.message,
    })
  }

  return NextResponse.json({
    available: true,
    provisional: quote.provisional,
    rate: quote.rate,
    rates: quote.rates,
    parcel: quote.parcel,
  })
}
