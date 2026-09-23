import { NextResponse, type NextRequest } from 'next/server'
import { calculateCcicUsOrder, parseCcicUsOrderDraftInput } from '@/lib/christmas-cards/us/order'
import { getCcicUsShipTimeRates } from '@/lib/christmas-cards/us/shiptime'

export const runtime = 'nodejs'

const STATE_CODES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'])

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function normalizeZip(value: unknown) { return text(value).replace(/[^0-9-]/g, '').slice(0, 10) }
function normalizeState(value: unknown) { const state = text(value).toUpperCase(); return STATE_CODES.has(state) ? state : '' }

export async function POST(request: NextRequest) {
  let body: { draft?: unknown; addressLine1?: unknown; city?: unknown; state?: unknown; postalCode?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'The U.S. shipping request was not valid.' }, { status: 400 })
  }

  const draft = parseCcicUsOrderDraftInput(body.draft)
  if (!draft) return NextResponse.json({ error: 'Your U.S. cart could not be read.' }, { status: 400 })

  const order = calculateCcicUsOrder(draft)
  if (!order.hasOrder) return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })

  const addressLine1 = text(body.addressLine1)
  const city = text(body.city)
  const state = normalizeState(body.state)
  const postalCode = normalizeZip(body.postalCode)

  if (!addressLine1 || !city || !state || !/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    return NextResponse.json({ error: 'Complete a valid U.S. shipping address to calculate shipping.' }, { status: 400 })
  }

  try {
    const quote = await getCcicUsShipTimeRates({
      destination: { addressLine1, city, state, postalCode },
      totalBoxes: order.totalSelectedBoxes,
      subtotalUsdCents: order.subtotalCents,
      nonCasePricingBoxCount: order.nonCasePricingBoxCount,
      accessorySheetCount: order.accessorySheetCount,
    })

    return NextResponse.json({
      available: true,
      rate: quote.selectedRate,
      rates: quote.rates,
      parcelCount: quote.parcelCount,
      shippingCadPerUsdFloor: quote.shippingCadPerUsdFloor,
      dutiesPaidBy: quote.dutiesPaidBy,
    })
  } catch (error) {
    console.error('CCIC U.S. ShipTime rating failed', error)
    return NextResponse.json({
      available: false,
      message: error instanceof Error ? error.message : 'U.S. shipping could not be calculated.',
    })
  }
}
