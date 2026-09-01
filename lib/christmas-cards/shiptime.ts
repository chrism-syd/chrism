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
  phone: '905 555 0100',
  residential: false,
  notify: false,
}

type ShipTimeTokenResponse = { access_token?: string; error?: string; error_description?: string }
type ShipTimeMoney = { currency?: string; amount?: number }
type ShipTimeRate = {
  carrierName?: string
  serviceId?: string
  serviceName?: string
  transitDays?: number
  totalCharge?: ShipTimeMoney
  totalBeforeTaxes?: ShipTimeMoney
  isShipTimeCarrier?: boolean
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

function nextBusinessShipDate() {
  const date = new Date()
  date.setUTCHours(12, 0, 0, 0)
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function isCanadaPostCarrier(name: string | undefined) {
  return Boolean(name && name.toLowerCase().replace(/[^a-z]/g, '').includes('canadapost'))
}

function postalCityFromMismatch(messages: string[] | undefined) {
  const detail = messages?.join(' | ') || ''
  const match = detail.match(/postal\s*code[\s\S]*?only valid for\s+([^.|]+?)(?:\.|\||$)/i)
  return match?.[1]?.trim() || null
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
    const detail = [payload?.error, payload?.error_description].filter(Boolean).join(': ')
    throw new Error(`ShipTime authentication failed (${response.status}).${detail ? ` ${detail}` : ''}`)
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
  declaredValueCents: number
}) {
  const token = await getAccessToken()
  const destinationPostalCode = compactPostalCode(args.destinationPostalCode)

  const requestRates = async (ratingCity: string) => {
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
          city: ratingCity,
          countryCode: 'CA',
          state: args.destinationAddress.province,
          postalCode: destinationPostalCode,
          attention: 'CCIC Customer',
          phone: '905 555 0101',
          residential: true,
          notify: false,
        },
        packageType: 'PACKAGE',
        lineItems: [{
          length: args.parcel.lengthCm,
          width: args.parcel.widthCm,
          height: args.parcel.heightCm,
          weight: args.parcel.weightKg,
          declaredValue: { currency: 'CAD', amount: Math.max(1, Math.round(args.declaredValueCents)) },
          description: 'Christmas greeting cards',
        }],
        unitOfMeasurement: 'METRIC',
        serviceOptions: ['SIGNATURE'],
        insuranceType: 'SHIPTIME',
        shipDate: nextBusinessShipDate(),
        waitTimeLimit: 30,
      }),
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => null) as ShipTimeRatesResponse | null
    return { response, payload }
  }

  let attempt = await requestRates(args.destinationAddress.city)
  if (!attempt.response.ok || !attempt.payload?.availableRates) {
    const postalCity = postalCityFromMismatch(attempt.payload?.messages)
    if (attempt.response.status === 400 && postalCity && postalCity.toLowerCase() !== args.destinationAddress.city.trim().toLowerCase()) {
      console.info('CCIC ShipTime retrying rating with postal city', {
        customerCity: args.destinationAddress.city,
        ratingCity: postalCity,
        postalCode: destinationPostalCode,
      })
      attempt = await requestRates(postalCity)
    }
  }

  const { response, payload } = attempt
  if (!response.ok || !payload?.availableRates) {
    const detail = payload?.messages?.join(' | ') || ''
    throw new Error(`ShipTime rating failed (${response.status}).${detail ? ` ${detail}` : ''}`)
  }

  const canadaPostRates = payload.availableRates.filter((rate) => isCanadaPostCarrier(rate.carrierName))
  const connectedAccountRates = canadaPostRates.filter((rate) => rate.isShipTimeCarrier === false)
  const preferredRates = connectedAccountRates.length ? connectedAccountRates : canadaPostRates

  console.info('CCIC ShipTime Canada Post rating candidates', preferredRates.map((rate) => ({
    carrierName: rate.carrierName,
    serviceId: rate.serviceId,
    serviceName: rate.serviceName,
    connectedAccount: rate.isShipTimeCarrier === false,
    currency: rate.totalCharge?.currency,
    totalCharge: rate.totalCharge?.amount,
    totalBeforeTaxes: rate.totalBeforeTaxes?.amount,
  })))

  const rates = preferredRates.flatMap((rate): CcicShippingRate[] => {
    if (!rate.serviceId || !rate.serviceName || rate.totalCharge?.currency !== 'CAD' || typeof rate.totalCharge.amount !== 'number') return []
    return [{
      serviceCode: rate.serviceId,
      serviceName: rate.serviceName,
      amountCents: rate.totalCharge.amount,
      expectedTransitTime: typeof rate.transitDays === 'number' ? rate.transitDays : null,
    }]
  })

  if (!rates.length) {
    const carriers = [...new Set(payload.availableRates.map((rate) => rate.carrierName).filter(Boolean))].join(', ')
    throw new Error(`ShipTime returned rates, but no Canada Post rate matched.${carriers ? ` Carriers returned: ${carriers}.` : ''}`)
  }

  return rates
}
