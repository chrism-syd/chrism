const CANADA_POST_TOKEN_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token'
const CANADA_POST_RATING_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/rating/v1/prices'

export const CCIC_SHIPPING_ORIGIN_POSTAL_CODE = 'L3P4N1'

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

type CanadaPostTokenResponse = {
  access_token?: string
}

type CanadaPostRateResponse = Array<{
  serviceCode?: string
  serviceName?: string
  priceDetails?: { due?: number }
  serviceStandard?: { expectedTransitTime?: number }
}>

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function compactPostalCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
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
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'merchant',
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null) as CanadaPostTokenResponse | null
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Canada Post authentication failed (${response.status}).`)
  }

  return payload.access_token
}

export async function getCcicCanadaPostRates(args: {
  destinationPostalCode: string
  parcel: CcicShippingPackage
}) {
  const customerNumber = requiredEnvironment('CANADA_POST_CUSTOMER_NUMBER')
  const token = await getAccessToken()

  const response = await fetch(CANADA_POST_RATING_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'accept-language': 'en-CA',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      customerNumber,
      quoteType: 'commercial',
      parcelCharacteristics: {
        weight: args.parcel.weightKg,
        dimensions: {
          length: args.parcel.lengthCm,
          width: args.parcel.widthCm,
          height: args.parcel.heightCm,
        },
        unpackaged: false,
        mailingTube: false,
      },
      originPostalCode: CCIC_SHIPPING_ORIGIN_POSTAL_CODE,
      destination: {
        domestic: {
          postalCode: compactPostalCode(args.destinationPostalCode),
        },
      },
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null) as CanadaPostRateResponse | { errorMessage?: string } | null
  if (!response.ok || !Array.isArray(payload)) {
    const detail = payload && !Array.isArray(payload) && payload.errorMessage ? ` ${payload.errorMessage}` : ''
    throw new Error(`Canada Post rating failed (${response.status}).${detail}`)
  }

  return payload.flatMap((rate): CcicShippingRate[] => {
    const due = rate.priceDetails?.due
    if (!rate.serviceCode || !rate.serviceName || typeof due !== 'number') return []
    return [{
      serviceCode: rate.serviceCode,
      serviceName: rate.serviceName,
      amountCents: Math.round(due * 100),
      expectedTransitTime: typeof rate.serviceStandard?.expectedTransitTime === 'number'
        ? rate.serviceStandard.expectedTransitTime
        : null,
    }]
  })
}

export function selectCcicShippingRate(rates: CcicShippingRate[]) {
  return rates.find((rate) => rate.serviceCode === 'DOM.EP')
    ?? rates.find((rate) => rate.serviceCode === 'DOM.RP')
    ?? rates.reduce<CcicShippingRate | null>((best, rate) => !best || rate.amountCents < best.amountCents ? rate : best, null)
}
