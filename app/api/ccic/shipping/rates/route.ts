import { NextResponse, type NextRequest } from 'next/server'
import { quoteCcicShipping } from '@/lib/christmas-cards/canada-post'

export const runtime = 'nodejs'

const PROVINCE_CODES: Record<string, string> = {
  AB: 'AB', ALBERTA: 'AB', BC: 'BC', 'BRITISH COLUMBIA': 'BC', MB: 'MB', MANITOBA: 'MB',
  NB: 'NB', 'NEW BRUNSWICK': 'NB', NL: 'NL', 'NEWFOUNDLAND AND LABRADOR': 'NL', NT: 'NT', 'NORTHWEST TERRITORIES': 'NT',
  NS: 'NS', 'NOVA SCOTIA': 'NS', NU: 'NU', NUNAVUT: 'NU', ON: 'ON', ONTARIO: 'ON', PE: 'PE', 'PRINCE EDWARD ISLAND': 'PE',
  QC: 'QC', QUEBEC: 'QC', QUÉBEC: 'QC', SK: 'SK', SASKATCHEWAN: 'SK', YT: 'YT', YUKON: 'YT',
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function normalizePostalCode(value: unknown) { return text(value).toUpperCase().replace(/[^A-Z0-9]/g, '') }
function normalizeProvince(value: unknown) { return PROVINCE_CODES[text(value).toUpperCase()] || '' }

export async function POST(request: NextRequest) {
  let body: { postalCode?: unknown; totalBoxes?: unknown; addressLine1?: unknown; city?: unknown; province?: unknown }

  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'The shipping request was not valid.' }, { status: 400 })
  }

  const postalCode = normalizePostalCode(body.postalCode)
  const addressLine1 = text(body.addressLine1)
  const city = text(body.city)
  const province = normalizeProvince(body.province)

  if (!/^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTVWXYZ][0-9][ABCEGHJ-NPRSTVWXYZ][0-9]$/.test(postalCode)) {
    return NextResponse.json({ error: 'Enter a valid Canadian postal code.' }, { status: 400 })
  }
  if (!addressLine1 || !city || !province) {
    return NextResponse.json({ error: 'Complete the shipping address to calculate shipping.' }, { status: 400 })
  }

  const totalBoxes = typeof body.totalBoxes === 'number' && Number.isFinite(body.totalBoxes)
    ? Math.max(1, Math.floor(body.totalBoxes))
    : 1

  const quote = await quoteCcicShipping({
    destination: { addressLine1, city, province, postalCode },
    totalBoxes,
  })
  if (quote.status === 'pending') {
    return NextResponse.json({ available: false, provisional: quote.provisional, reason: quote.reason, message: quote.message })
  }

  return NextResponse.json({ available: true, provisional: quote.provisional, rate: quote.rate, rates: quote.rates, parcel: quote.parcel, parcelCount: quote.parcelCount })
}
