import type { CcicShippingPackage, CcicShippingRate } from './canada-post'

const SHIPTIME_TOKEN_URL = 'https://restapi.shiptime.com/oauth2/token'
const SHIPTIME_RATES_URL = 'https://restapi.shiptime.com/rest/rates'

const ORIGIN = {
  companyName: 'CCIC',
  streetAddress: '37 White Ash Drive',
  city: 'Markham',
  countryCode: 'CA',
  state: 'ON',
  postalCode: 'L3P4N1',
  attention: 'CCIC Shipping',
  phone: '9055550100',
  residential: false,
  notify: false,
}

type ShipTimeTokenResponse = { access_token?: string }
type ShipTimeMoney = { currency?: string; amount?: number }
type ShipTimeRate = {
  carrierName?: string
  serviceId?: string
  serviceName?: string
  transitDays?: number
  totalCharge?: ShipTimeMoney
}
type ShipTimeRatesResponse = {
  availableRates?: ShipTimeRate[]
  success?: boolean
  messages?: string[]
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function compactPostalCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

async function getAccessToken() {
  const response = await fetch(SHIPTIME_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: requiredEnvironment('SHIPTIME_CLIENT_ID'),
      client_secret: requiredEnvironment('SHIPTIME_CLIENT_SECRET'),
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null) as ShipTimeTokenResponse | null
  if (!response.ok || !payload?.access_token) {
    throw new Error(`ShipTime authentication failed (${response.status}).`)
  }
  return payload.access_token
}

export async function getCcicShipTimeCanadaPostRates(args: {
  destinationPostalCode: string
  destinationAddress: {
    addressLine1: string
    city: string
    province: string
  }
  parcel: CcicShippingPackage
}) {
  const token = await getAccessToken()
  const destinationPostalCode = compactPostalCode(args.destinationPostalCode)

  const response = await fetch(SHIPTIME_RATES_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: ORIGIN,
      to: {
        companyName: 'CCIC Customer',
        streetAddress: args.destinationAddress.addressLine1 || 'Shipping address',
        city: args.destinationAddress.city,
        countryCode: 'CA',
        state: args.destinationAddress.province,
        postalCode: destinationPostalCode,
        attention: 'CCIC Customer',
        phone: '9055550101',
        residential: true,
        notify: false,
      },
      packageType: 'PACKAGE',
      lineItems: [{
        length: args.parcel.lengthCm,
        width: args.parcel.widthCm,
        height: args.parcel.heightCm,
        weight: args.parcel.weightKg,
        declaredValue: { currency: 'CAD', amount: 0 },
        description: 'Christmas greeting cards',
      }],
      unitOfMeasurement: 'METRIC',
      shipDate: new Date().toISOString(),
      waitTimeLimit: 30,
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null) as ShipTimeRatesResponse | null
  if (!response.ok || !payload?.availableRates) {
    const detail = payload?.messages?.join(' | ') || ''
    throw new Error(`ShipTime rating failed (${response.status}).${detail ? ` ${detail}` : ''}`)
  }

  const rates = payload.availableRates.flatMap((rate): CcicShippingRate[] => {
    if (rate.carrierName !== 'Canada Post') return []
    if (!rate.serviceId || !rate.serviceName || rate.totalCharge?.currency !== 'CAD' || typeof rate.totalCharge.amount !== 'number') return []
    return [{
      serviceCode: rate.serviceId,
      serviceName: rate.serviceName,
      amountCents: rate.totalCharge.amount,
      expectedTransitTime: typeof rate.transitDays === 'number' ? rate.transitDays : null,
    }]
  })

  console.info('CCIC ShipTime Canada Post rating response', rates)
  return rates
}
