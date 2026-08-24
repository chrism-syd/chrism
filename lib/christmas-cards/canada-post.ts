import { getCcicShipTimeCanadaPostRates } from './shiptime'

const CANADA_POST_TOKEN_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token'
const CANADA_POST_RATING_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/rating/v1/prices'

export const CCIC_SHIPPING_ORIGIN_POSTAL_CODE = 'L3P4N1'
export const CCIC_MANUAL_SHIPPING_MESSAGE = 'Shipping & Handling will be calculated after your order has been reviewed for packing. We will email you with the final amount before payment.'

export type CcicShippingPackage = { weightKg: number; lengthCm: number; widthCm: number; heightCm: number }
export type CcicShippingRate = { serviceCode: string; serviceName: string; amountCents: number; expectedTransitTime: number | null }
export type CcicShippingDestination = { addressLine1: string; city: string; province: string; postalCode: string }
export type CcicPackedShippingParcel = { carton: 'medium' | 'large'; boxCount: number; parcel: CcicShippingPackage }
export type CcicShippingQuote =
  | { status: 'priced'; provisional: true; rate: CcicShippingRate; rates: CcicShippingRate[]; parcel: CcicShippingPackage; parcels: CcicPackedShippingParcel[]; parcelCount: number }
  | { status: 'pending'; provisional: true; reason: 'packing_required' | 'rate_unavailable'; message: string }

type CanadaPostTokenResponse = { access_token?: string }
type CanadaPostRateResponse = Array<{ serviceCode?: string; serviceName?: string; priceDetails?: { due?: number }; serviceStandard?: { expectedTransitTime?: number } }>
type CanadaPostErrorResponse = { errorCode?: string; errorMessage?: string; errorDescription?: string; code?: string; message?: string; title?: string; detail?: string; errors?: Array<{ errorCode?: string; message?: string }> }

const KG_PER_RETAIL_BOX = 6.5 / 32
const CARDS_PER_RETAIL_BOX = 12
const COST_PER_CARD_CENTS = 64
const MEDIUM_CARTON = { carton: 'medium' as const, maxBoxes: 32, lengthCm: 30.48, widthCm: 22.86, heightCm: 22.86 }
const LARGE_CARTON = { carton: 'large' as const, maxBoxes: 42, lengthCm: 40.64, widthCm: 30.48, heightCm: 20.32 }

function requiredEnvironment(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is not configured.`); return value }
function optionalEnvironment(name: string) { return process.env[name]?.trim() || null }
function compactPostalCode(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, '') }
function canadaPostErrorDetail(payload: CanadaPostErrorResponse | null) {
  if (!payload) return ''
  const nested = payload.errors?.map((error) => [error.errorCode, error.message].filter(Boolean).join(': ')).filter(Boolean).join(' | ')
  if (nested) return nested
  return [payload.errorCode || payload.code || '', payload.errorDescription || payload.errorMessage || payload.message || payload.detail || payload.title || ''].filter(Boolean).join(': ')
}

async function getAccessToken() {
  const basic = Buffer.from(`${requiredEnvironment('CANADA_POST_CLIENT_ID')}:${requiredEnvironment('CANADA_POST_CLIENT_SECRET')}`).toString('base64')
  const response = await fetch(CANADA_POST_TOKEN_URL, { method: 'POST', headers: { accept: 'application/json', authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'merchant' }), cache: 'no-store' })
  const payload = await response.json().catch(() => null) as CanadaPostTokenResponse | CanadaPostErrorResponse | null
  if (!response.ok || !payload || !('access_token' in payload) || !payload.access_token) throw new Error(`Canada Post authentication failed (${response.status}).`)
  return payload.access_token
}

function buildRatingBody(args: { customerNumber: string; contractId?: string | null; destinationPostalCode: string; parcel: CcicShippingPackage }) {
  return { customerNumber: args.customerNumber, ...(args.contractId ? { contractId: args.contractId } : {}), quoteType: 'commercial' as const, parcelCharacteristics: { weight: args.parcel.weightKg, dimensions: { length: args.parcel.lengthCm, width: args.parcel.widthCm, height: args.parcel.heightCm }, unpackaged: false, mailingTube: false, oversized: false }, originPostalCode: CCIC_SHIPPING_ORIGIN_POSTAL_CODE, destination: { domestic: { postalCode: compactPostalCode(args.destinationPostalCode) } } }
}

async function requestRates(token: string, body: ReturnType<typeof buildRatingBody>) {
  const response = await fetch(CANADA_POST_RATING_URL, { method: 'POST', headers: { accept: 'application/json', 'accept-language': 'en-CA', authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
  const payload = await response.json().catch(() => null) as CanadaPostRateResponse | CanadaPostErrorResponse | null
  return { response, payload }
}

// Kept intentionally as a direct Canada Post implementation so we can switch back if Canada Post resolves production provisioning.
export async function getCcicCanadaPostRates(args: { destinationPostalCode: string; parcel: CcicShippingPackage }) {
  const customerNumber = requiredEnvironment('CANADA_POST_CUSTOMER_NUMBER')
  const contractId = optionalEnvironment('CANADA_POST_CONTRACT_ID')
  const token = await getAccessToken()
  let attempt = await requestRates(token, buildRatingBody({ customerNumber, contractId, ...args }))
  if (contractId && attempt.response.status === 400 && !Array.isArray(attempt.payload)) {
    const detail = canadaPostErrorDetail(attempt.payload)
    if (detail.toLowerCase().includes('contract') || detail.toLowerCase().includes('schema validation')) attempt = await requestRates(token, buildRatingBody({ customerNumber, ...args }))
  }
  if (!attempt.response.ok || !Array.isArray(attempt.payload)) {
    const detail = attempt.payload && !Array.isArray(attempt.payload) ? canadaPostErrorDetail(attempt.payload) : ''
    throw new Error(`Canada Post rating failed (${attempt.response.status}).${detail ? ` ${detail}` : ''}`)
  }
  return attempt.payload.flatMap((rate): CcicShippingRate[] => {
    const due = rate.priceDetails?.due
    if (!rate.serviceCode || !rate.serviceName || typeof due !== 'number') return []
    return [{ serviceCode: rate.serviceCode, serviceName: rate.serviceName, amountCents: Math.round(due * 100), expectedTransitTime: typeof rate.serviceStandard?.expectedTransitTime === 'number' ? rate.serviceStandard.expectedTransitTime : null }]
  })
}

export function selectCcicShippingRate(rates: CcicShippingRate[]) {
  return rates.find((rate) => rate.serviceCode === 'DOM.EP') ?? rates.find((rate) => rate.serviceCode === 'DOM.RP') ?? rates.reduce<CcicShippingRate | null>((best, rate) => !best || rate.amountCents < best.amountCents ? rate : best, null)
}

function makePackedParcel(carton: typeof MEDIUM_CARTON | typeof LARGE_CARTON, boxCount: number): CcicPackedShippingParcel {
  return {
    carton: carton.carton,
    boxCount,
    parcel: {
      weightKg: Number((boxCount * KG_PER_RETAIL_BOX).toFixed(3)),
      lengthCm: carton.lengthCm,
      widthCm: carton.widthCm,
      heightCm: carton.heightCm,
    },
  }
}

export function buildCcicPackingPlan(totalBoxes: number): CcicPackedShippingParcel[] {
  const boxes = Math.max(1, Math.floor(totalBoxes))

  if (boxes <= MEDIUM_CARTON.maxBoxes) return [makePackedParcel(MEDIUM_CARTON, boxes)]
  if (boxes <= LARGE_CARTON.maxBoxes) return [makePackedParcel(LARGE_CARTON, boxes)]

  // For 43–57 boxes, split across two medium cartons rather than create a nearly-empty second carton.
  if (boxes <= 57) {
    const first = Math.ceil(boxes / 2)
    return [makePackedParcel(MEDIUM_CARTON, first), makePackedParcel(MEDIUM_CARTON, boxes - first)]
  }

  // From 58–74 boxes, fill the large carton to 42 and use the medium carton for the 16–32 box remainder.
  if (boxes <= 74) return [makePackedParcel(LARGE_CARTON, 42), makePackedParcel(MEDIUM_CARTON, boxes - 42)]

  // Larger orders repeat the same pattern recursively.
  return [makePackedParcel(LARGE_CARTON, 42), ...buildCcicPackingPlan(boxes - 42)]
}

function combineSelectedParcelRates(selectedRates: CcicShippingRate[]): CcicShippingRate {
  const sameService = selectedRates.every((rate) => rate.serviceCode === selectedRates[0].serviceCode)
  const transitTimes = selectedRates.map((rate) => rate.expectedTransitTime).filter((value): value is number => typeof value === 'number')
  return {
    serviceCode: sameService ? selectedRates[0].serviceCode : 'MULTI',
    serviceName: selectedRates.length === 1
      ? selectedRates[0].serviceName
      : sameService
        ? `${selectedRates[0].serviceName} (${selectedRates.length} parcels)`
        : `Shipping (${selectedRates.length} parcels)`,
    amountCents: selectedRates.reduce((sum, rate) => sum + rate.amountCents, 0),
    expectedTransitTime: transitTimes.length === selectedRates.length ? Math.max(...transitTimes) : null,
  }
}

export async function quoteCcicShipping(args: { destination: CcicShippingDestination; totalBoxes: number }): Promise<CcicShippingQuote> {
  const parcels = buildCcicPackingPlan(args.totalBoxes)
  try {
    const selectedParcelRates = await Promise.all(parcels.map(async ({ parcel, boxCount }) => {
      const declaredValueCents = boxCount * CARDS_PER_RETAIL_BOX * COST_PER_CARD_CENTS
      const rates = await getCcicShipTimeCanadaPostRates({
        destinationPostalCode: args.destination.postalCode,
        destinationAddress: {
          addressLine1: args.destination.addressLine1,
          city: args.destination.city,
          province: args.destination.province,
        },
        parcel,
        declaredValueCents,
      })
      const selected = selectCcicShippingRate(rates)
      if (!selected) throw new Error('ShipTime returned no usable Canada Post rate for one of the packed parcels.')
      return selected
    }))

    const rate = combineSelectedParcelRates(selectedParcelRates)
    return {
      status: 'priced',
      provisional: true,
      rate,
      rates: selectedParcelRates,
      parcel: parcels[0].parcel,
      parcels,
      parcelCount: parcels.length,
    }
  } catch (error) {
    console.error('CCIC ShipTime Canada Post rating failed', error)
    return { status: 'pending', provisional: true, reason: 'rate_unavailable', message: CCIC_MANUAL_SHIPPING_MESSAGE }
  }
}