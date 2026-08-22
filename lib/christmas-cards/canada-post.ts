const CANADA_POST_TOKEN_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token'
const CANADA_POST_RATING_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/rating/v1/prices'

export const CCIC_SHIPPING_ORIGIN_POSTAL_CODE = 'L3P4N1'
export const CCIC_MANUAL_SHIPPING_MESSAGE = 'Shipping will be calculated after your order has been reviewed for packing. We will email you with the shipping cost before payment.'

export type CcicShippingPackage = {
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export type CcicShippingRate = {
  serviceCode: string
  serviceName: string
  amountCents: number
  expectedTransitTime: number | null
}

export type CcicShippingQuote =
  | { status: 'priced'; provisional: true; rate: CcicShippingRate; rates: CcicShippingRate[]; parcel: CcicShippingPackage; parcelCount: number }
  | { status: 'pending'; provisional: true; reason: 'packing_required' | 'rate_unavailable'; message: string }

type CanadaPostTokenResponse = { access_token?: string }
type CanadaPostRateResponse = Array<{
  serviceCode?: string
  serviceName?: string
  priceDetails?: { due?: number }
  serviceStandard?: { expectedTransitTime?: number }
}>
type CanadaPostErrorResponse = {
  errorCode?: string
  errorMessage?: string
  errorDescription?: string
  code?: string
  message?: string
  title?: string
  detail?: string
  errors?: Array<{
    errorCode?: string
    message?: string
  }>
}

const PROVISIONAL_FULL_CASE: CcicShippingPackage = {
  weightKg: 6.5,
  lengthCm: 45.7,
  widthCm: 30.5,
  heightCm: 12.7,
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function optionalEnvironment(name: string) {
  return process.env[name]?.trim() || null
}

function compactPostalCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function canadaPostErrorDetail(payload: CanadaPostErrorResponse | null) {
  if (!payload) return ''

  const nested = payload.errors
    ?.map((error) => [error.errorCode, error.message].filter(Boolean).join(': '))
    .filter(Boolean)
    .join(' | ')

  if (nested) return nested

  const code = payload.errorCode || payload.code || ''
  const message = payload.errorDescription || payload.errorMessage || payload.message || payload.detail || payload.title || ''
  return [code, message].filter(Boolean).join(': ')
}

function logRatingRequest(args: {
  destinationPostalCode: string
  parcel: CcicShippingPackage
  hasContractId: boolean
}) {
  console.info('CCIC Canada Post rating request', {
    originPostalCode: CCIC_SHIPPING_ORIGIN_POSTAL_CODE,
    destinationPostalCode: compactPostalCode(args.destinationPostalCode),
    parcel: args.parcel,
    quoteType: 'commercial',
    hasContractId: args.hasContractId,
  })
}

function logRatingResponse(payload: CanadaPostRateResponse) {
  console.info('CCIC Canada Post rating response', payload.map((rate) => ({
    serviceCode: rate.serviceCode ?? null,
    serviceName: rate.serviceName ?? null,
    due: typeof rate.priceDetails?.due === 'number' ? rate.priceDetails.due : null,
    expectedTransitTime: typeof rate.serviceStandard?.expectedTransitTime === 'number'
      ? rate.serviceStandard.expectedTransitTime
      : null,
  })))
}

async function getAccessToken() {
  const clientId = requiredEnvironment('CANADA_POST_CLIENT_ID')
  const clientSecret = requiredEnvironment('CANADA_POST_CLIENT_SECRET')
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(CANADA_POST_TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'merchant' }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null) as CanadaPostTokenResponse | CanadaPostErrorResponse | null
  if (!response.ok || !payload || !('access_token' in payload) || !payload.access_token) {
    const detail = canadaPostErrorDetail(payload && !('access_token' in payload) ? payload : null)
    throw new Error(`Canada Post authentication failed (${response.status}).${detail ? ` ${detail}` : ''}`)
  }

  return payload.access_token
}

function buildRatingBody(args: {
  customerNumber: string
  contractId?: string | null
  destinationPostalCode: string
  parcel: CcicShippingPackage
}) {
  return {
    customerNumber: args.customerNumber,
    ...(args.contractId ? { contractId: args.contractId } : {}),
    quoteType: 'commercial' as const,
    parcelCharacteristics: {
      weight: args.parcel.weightKg,
      dimensions: {
        length: args.parcel.lengthCm,
        width: args.parcel.widthCm,
        height: args.parcel.heightCm,
      },
      unpackaged: false,
      mailingTube: false,
      oversized: false,
    },
    originPostalCode: CCIC_SHIPPING_ORIGIN_POSTAL_CODE,
    destination: {
      domestic: {
        postalCode: compactPostalCode(args.destinationPostalCode),
      },
    },
  }
}

async function requestRates(token: string, body: ReturnType<typeof buildRatingBody>) {
  const response = await fetch(CANADA_POST_RATING_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'accept-language': 'en-CA',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null) as CanadaPostRateResponse | CanadaPostErrorResponse | null
  return { response, payload }
}

export async function getCcicCanadaPostRates(args: { destinationPostalCode: string; parcel: CcicShippingPackage }) {
  const customerNumber = requiredEnvironment('CANADA_POST_CUSTOMER_NUMBER')
  const contractId = optionalEnvironment('CANADA_POST_CONTRACT_ID')
  const token = await getAccessToken()

  logRatingRequest({
    destinationPostalCode: args.destinationPostalCode,
    parcel: args.parcel,
    hasContractId: Boolean(contractId),
  })

  let attempt = await requestRates(token, buildRatingBody({
    customerNumber,
    contractId,
    destinationPostalCode: args.destinationPostalCode,
    parcel: args.parcel,
  }))

  if (
    contractId
    && attempt.response.status === 400
    && !Array.isArray(attempt.payload)
  ) {
    const detail = canadaPostErrorDetail(attempt.payload)
    console.info('CCIC Canada Post contract rating rejected', detail || 'No validation detail returned')

    if (detail.toLowerCase().includes('contract') || detail.toLowerCase().includes('schema validation')) {
      console.info('CCIC Canada Post retrying rating request without contractId')
      attempt = await requestRates(token, buildRatingBody({
        customerNumber,
        destinationPostalCode: args.destinationPostalCode,
        parcel: args.parcel,
      }))
    }
  }

  const { response, payload } = attempt
  if (!response.ok || !Array.isArray(payload)) {
    const detail = payload && !Array.isArray(payload) ? canadaPostErrorDetail(payload) : ''
    throw new Error(`Canada Post rating failed (${response.status}).${detail ? ` ${detail}` : ''}`)
  }

  logRatingResponse(payload)

  return payload.flatMap((rate): CcicShippingRate[] => {
    const due = rate.priceDetails?.due
    if (!rate.serviceCode || !rate.serviceName || typeof due !== 'number') return []
    return [{
      serviceCode: rate.serviceCode,
      serviceName: rate.serviceName,
      amountCents: Math.round(due * 100),
      expectedTransitTime: typeof rate.serviceStandard?.expectedTransitTime === 'number' ? rate.serviceStandard.expectedTransitTime : null,
    }]
  })
}

export function selectCcicShippingRate(rates: CcicShippingRate[]) {
  return rates.find((rate) => rate.serviceCode === 'DOM.EP')
    ?? rates.find((rate) => rate.serviceCode === 'DOM.RP')
    ?? rates.reduce<CcicShippingRate | null>((best, rate) => !best || rate.amountCents < best.amountCents ? rate : best, null)
}

function multiplyRate(rate: CcicShippingRate, parcelCount: number): CcicShippingRate {
  if (parcelCount <= 1) return rate
  return { ...rate, serviceName: `${rate.serviceName} (${parcelCount} parcels)`, amountCents: rate.amountCents * parcelCount }
}

export async function quoteCcicShipping(args: { destinationPostalCode: string; totalBoxes: number }): Promise<CcicShippingQuote> {
  const boxesPerCase = 32

  if (args.totalBoxes < boxesPerCase || args.totalBoxes % boxesPerCase !== 0) {
    return { status: 'pending', provisional: true, reason: 'packing_required', message: CCIC_MANUAL_SHIPPING_MESSAGE }
  }

  const parcelCount = args.totalBoxes / boxesPerCase

  try {
    const singleParcelRates = await getCcicCanadaPostRates({ destinationPostalCode: args.destinationPostalCode, parcel: PROVISIONAL_FULL_CASE })
    const singleParcelRate = selectCcicShippingRate(singleParcelRates)
    if (!singleParcelRate) return { status: 'pending', provisional: true, reason: 'rate_unavailable', message: CCIC_MANUAL_SHIPPING_MESSAGE }

    return {
      status: 'priced',
      provisional: true,
      rate: multiplyRate(singleParcelRate, parcelCount),
      rates: singleParcelRates.map((rate) => multiplyRate(rate, parcelCount)),
      parcel: PROVISIONAL_FULL_CASE,
      parcelCount,
    }
  } catch (error) {
    console.error('CCIC Canada Post rating failed', error)
    return { status: 'pending', provisional: true, reason: 'rate_unavailable', message: CCIC_MANUAL_SHIPPING_MESSAGE }
  }
}
