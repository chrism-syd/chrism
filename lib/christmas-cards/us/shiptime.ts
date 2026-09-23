import { buildCcicPackingPlan, type CcicPackedShippingParcel } from '../canada-post'

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

const SHIPPING_CAD_PER_USD_FLOOR = 1.25
const US_SHIPPING_HANDLING_CAD_CENTS = 200

type ShipTimeTokenResponse = { access_token?: string; error?: string; error_description?: string }
type ShipTimeMoney = { currency?: string; amount?: number }
type ShipTimeRate = {
  carrierId?: string
  carrierName?: string
  serviceId?: string
  serviceName?: string
  transitDays?: number
  totalCharge?: ShipTimeMoney
  totalBeforeTaxes?: ShipTimeMoney
  isShipTimeCarrier?: boolean
  surcharges?: Array<{ code?: string; name?: string; price?: ShipTimeMoney }>
  taxes?: Array<{ code?: string; name?: string; price?: ShipTimeMoney }>
}
type ShipTimeRatesResponse = { availableRates?: ShipTimeRate[]; success?: boolean; messages?: string[] }

export type CcicUsShippingRate = {
  carrierName: string
  serviceCode: string
  serviceName: string
  amountCadCents: number
  amountUsdCents: number
  expectedTransitTime: number | null
  shipTimeCarrier: boolean | null
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

function nextBusinessShipDate() {
  const date = new Date()
  date.setUTCHours(12, 0, 0, 0)
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
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

function cadToProtectedUsdCents(cadCents: number) {
  return Math.ceil(cadCents / SHIPPING_CAD_PER_USD_FLOOR)
}

export async function getCcicUsShipTimeRates(args: {
  destination: { addressLine1: string; city: string; state: string; postalCode: string }
  totalBoxes: number
  subtotalUsdCents: number
  nonCasePricingBoxCount?: number
  accessorySheetCount?: number
}) {
  if ((args.nonCasePricingBoxCount ?? 0) > 0 || (args.accessorySheetCount ?? 0) > 0) {
    throw new Error('U.S. automated customs quoting is currently limited to the standard Christmas card collection.')
  }

  const parcels: CcicPackedShippingParcel[] = buildCcicPackingPlan(args.totalBoxes, 0, 0)
  const token = await getAccessToken()
  const averageBoxValueUsdCents = Math.max(1, Math.round(args.subtotalUsdCents / Math.max(1, args.totalBoxes)))

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
        streetAddress: args.destination.addressLine1,
        city: args.destination.city,
        countryCode: 'US',
        state: args.destination.state,
        postalCode: args.destination.postalCode,
        attention: 'CCIC Customer',
        phone: '716 555 0101',
        residential: false,
        notify: false,
      },
      packageType: 'PACKAGE',
      unitOfMeasurement: 'METRIC',
      shipDate: nextBusinessShipDate(),
      lineItems: parcels.map(({ parcel }) => ({
        length: parcel.lengthCm,
        width: parcel.widthCm,
        height: parcel.heightCm,
        weight: parcel.weightKg,
        description: 'CCIC Christmas greeting cards',
      })),
      customsInvoice: {
        invoiceContact: ORIGIN,
        dutiesAndTaxes: {
          dutiable: true,
          paidBy: 'SHIPPER',
        },
        currency: 'USD',
        reasonForExport: 'COMMERCIAL',
        invoiceItems: [{
          quantity: args.totalBoxes,
          code: '4909004000',
          description: 'Printed Christmas greeting cards with envelopes',
          origin: 'CA',
          provinceOrState: 'ON',
          unitPrice: averageBoxValueUsdCents,
        }],
      },
      waitTimeLimit: 30,
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null) as ShipTimeRatesResponse | null
  if (!response.ok || !payload?.availableRates) {
    const detail = payload?.messages?.join(' | ') || ''
    throw new Error(`ShipTime U.S. rating failed (${response.status}).${detail ? ` ${detail}` : ''}`)
  }

  const rates = payload.availableRates.flatMap((rate): CcicUsShippingRate[] => {
    const amount = rate.totalCharge?.amount
    if (!rate.carrierName || !rate.serviceId || !rate.serviceName || rate.totalCharge?.currency !== 'CAD' || typeof amount !== 'number') return []
    const amountCadCents = amount + US_SHIPPING_HANDLING_CAD_CENTS
    return [{
      carrierName: rate.carrierName,
      serviceCode: rate.serviceId,
      serviceName: rate.serviceName,
      amountCadCents,
      amountUsdCents: cadToProtectedUsdCents(amountCadCents),
      expectedTransitTime: typeof rate.transitDays === 'number' ? rate.transitDays : null,
      shipTimeCarrier: typeof rate.isShipTimeCarrier === 'boolean' ? rate.isShipTimeCarrier : null,
    }]
  }).sort((a, b) => a.amountUsdCents - b.amountUsdCents)

  if (!rates.length) throw new Error('ShipTime returned no usable U.S. rates in CAD.')

  return {
    rates,
    selectedRate: rates[0],
    parcels,
    parcelCount: parcels.length,
    shippingCadPerUsdFloor: SHIPPING_CAD_PER_USD_FLOOR,
    dutiesPaidBy: 'SHIPPER' as const,
  }
}
