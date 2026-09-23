import {
  CHRISTMAS_CARD_BOXES as BASE_BOXES,
  CHRISTMAS_CARD_COLLECTIONS,
  CHRISTMAS_CARD_CURATED_CASES as BASE_CASES,
  type ChristmasCardBox,
  type ChristmasCardCollection,
  type ChristmasCardCuratedCase,
} from '../catalog'

export type { ChristmasCardBox, ChristmasCardCollection, ChristmasCardCuratedCase }

export const CHRISTMAS_CARD_ORDER_CONFIG = {
  brandName: 'Celebrate Christ in Christmas',
  boxesPerCase: 32,
  customCasePriceCents: 29999,
  promotionPackageCents: 0,
  campaignPackageCents: 0,
  currencyCode: 'USD',
  shippingLabel: 'U.S. shipping and import charges calculated at checkout.',
} as const

function usBoxPrice(box: ChristmasCardBox) {
  if (box.isAccessory) return 199
  if (!box.isCasePricingEligible) return 1099
  return 1099
}

export const CHRISTMAS_CARD_BOXES: ChristmasCardBox[] = BASE_BOXES.map((box) => ({
  ...box,
  priceCents: usBoxPrice(box),
}))

export const CHRISTMAS_CARD_CURATED_CASES: ChristmasCardCuratedCase[] = BASE_CASES.map((item) => ({
  ...item,
  priceCents: 27499,
}))

export { CHRISTMAS_CARD_COLLECTIONS }

export function formatUsChristmasCardMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
