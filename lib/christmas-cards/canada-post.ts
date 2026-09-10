import { getCcicShipTimeCanadaPostRates } from './shiptime'

const CANADA_POST_TOKEN_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token'
const CANADA_POST_RATING_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/rating/v1/prices'

export const CCIC_SHIPPING_ORIGIN_POSTAL_CODE = 'L3P4N1'
export const CCIC_MANUAL_SHIPPING_MESSAGE = 'Shipping & Handling will be calculated after your order has been reviewed for packing. We will email you with the final amount before payment.'

export type CcicShippingPackage = { weightKg: number; lengthCm: number; widthCm: number; heightCm: number }
export type CcicShippingRate = { serviceCode: string; serviceName: string; amountCents: number; expectedTransitTime: number | null }
export type CcicShippingDestination = { addressLine1: string; city: string; province: string; postalCode: string }
export type CcicPackedShippingParcel = { carton: 'small' | 'medium' | 'large'; boxCount: number; parcel: CcicShippingPackage }
export type CcicShippingQuote =
  | { status: 'priced'; provisional: true; rate: CcicShippingRate; rates: CcicShippingRate[]; parcel: CcicShippingPackage; parcels: CcicPackedShippingParcel[]; parcelCount: number }
  | { status: 'pending'; provisional: true; reason: 'packing_required' | 'rate_unavailable'; message: string }

type CanadaPostTokenResponse = { access_token?: string }
type CanadaPostRateResponse = Array<{ serviceCode?: string; serviceName?: string; priceDetails?: { due?: number }; serviceStandard?: { expectedTransitTime?: number } }>
type CanadaPostErrorResponse = { errorCode?: string; errorMessage?: string; errorDescription?: string; code?: string; message?: string; title?: string; detail?: string; errors?: Array<{ errorCode?: string; message?: string }> }

// Measured finished retail boxes, including 12 cards, 12 envelopes, and the acrylic case.
const KG_PER_RETAIL_BOX = 0.165
const KG_PER_NON_CASE_PRICING_BOX = 0.2
const SHIPPING_HANDLING_FEE_CENTS = 200
// Carton weights supplied by the box vendor. These are added once per parcel to the product weight.
const SMALL_CARTON = { carton: 'small' as const, maxBoxes: 12, lengthCm: 22.86, widthCm: 15.24, heightCm: 15.24, weightKg: 0.16 }
const MEDIUM_CARTON = { carton: 'medium' as const, maxBoxes: 32, lengthCm: 30.48, widthCm: 22.86, heightCm: 22.86, weightKg: 0.27 }
const LARGE_CARTON = { carton: 'large' as const, maxBoxes: 42, lengthCm: 40.64, widthCm: 30.48, heightCm: 20.32, weightKg: 0.46 }

type CcicCarton = typeof SMALL_CARTON | typeof MEDIUM_CARTON | typeof LARGE_CARTON

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

function makePackedParcel(carton: CcicCarton, boxCount: number, heavyBoxCount = 0): CcicPackedShippingParcel {
  const heavyBoxes = Math.max(0, Math.min(boxCount, Math.floor(heavyBoxCount)))
  const regularBoxes = boxCount - heavyBoxes
  return {
    carton: carton.carton,
    boxCount,
    parcel: {
      weightKg: Number((regularBoxes * KG_PER_RETAIL_BOX + heavyBoxes * KG_PER_NON_CASE_PRICING_BOX + carton.weightKg).toFixed(3)),
      lengthCm: carton.lengthCm,
      widthCm: carton.widthCm,
      heightCm: carton.heightCm,
    },
  }
}

function buildCcicCartonPlan(totalBoxes: number): Array<{ carton: CcicCarton; boxCount: number }> {
  const boxes = Math.max(1, Math.floor(totalBoxes))

  if (boxes <= SMALL_CARTON.maxBoxes) return [{ carton: SMALL_CARTON, boxCount: boxes }]
  if (boxes <= MEDIUM_CARTON.maxBoxes) return [{ carton: MEDIUM_CARTON, boxCount: boxes }]
  if (boxes <= LARGE_CARTON.maxBoxes) return [{ carton: LARGE_CARTON, boxCount: boxes }]

  if (boxes <= 57) {
    const first = Math.ceil(boxes / 2)
    return [{ carton: MEDIUM_CARTON, boxCount: first }, { carton: MEDIUM_CARTON, boxCount: boxes - first }]
  }

  if (boxes <= 74) return [{ carton: LARGE_CARTON, boxCount: 42 }, { carton: MEDIUM_CARTON, boxCount: boxes - 42 }]

  return [{ carton: LARGE_CARTON, boxCount: 42 }, ...buildCcicCartonPlan(boxes - 42)]
}

export function buildCcicPackingPlan(totalBoxes: number, nonCasePricingBoxCount = 0): CcicPackedShippingParcel[] {
  const cartonPlan = buildCcicCartonPlan(totalBoxes)
  const totalPackedBoxes = cartonPlan.reduce((sum, packed) => sum + packed.boxCount, 0)
  let heavyBoxesRemaining = Math.max(0, Math.min(totalPackedBoxes, Math.floor(nonCasePricingBoxCount)))
  let boxesRemaining = totalPackedBoxes

  return cartonPlan.map(({ carton, boxCount }) => {
    // Spread heavier boxes proportionally across multi-parcel orders so each rated parcel reflects the product mix.
    const heavyBoxCount = boxesRemaining === boxCount
      ? heavyBoxesRemaining
      : Math.min(boxCount, Math.round((heavyBoxesRemaining * boxCount) / boxesRemaining))
    heavyBoxesRemaining -= heavyBoxCount
    boxesRemaining -= boxCount
    return makePackedParcel(carton, boxCount, heavyBoxCount)
  })
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
    amountCents: selectedRates.reduce((sum, rate) => sum + rate.amountCents, 0) + SHIPPING_HANDLING_FEE_CENTS,
    expectedTransitTime: transitTimes.length === selectedRates.length ? Math.max(...transitTimes) : null,
  }
}

export async function quoteCcicShipping(args: { destination: CcicShippingDestination; totalBoxes: number; nonCasePricingBoxCount?: number }): Promise<CcicShippingQuote> {
  const parcels = buildCcicPackingPlan(args.totalBoxes, args.nonCasePricingBoxCount ?? 0)
  try {
    const selectedParcelRates = await Promise.all(parcels.map(async ({ parcel }) => {
      const rates = await getCcicShipTimeCanadaPostRates({
        destinationPostalCode: args.destination.postalCode,
        destinationAddress: {
          addressLine1: args.destination.addressLine1,
          city: args.destination.city,
          province: args.destination.province,
        },
        parcel,
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
