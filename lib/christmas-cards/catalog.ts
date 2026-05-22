export type ChristmasCardLanguageCode = 'en' | 'fr' | 'pl' | 'es' | 'tl' | 'zh'

export type ChristmasCardBox = {
  id: string
  sku: string
  title: string
  description: string
  insideMessage: string
  frontImageUrl: string | null
  insideImageUrl: string | null
  outsideImageUrl: string | null
  themeTags: string[]
  languageCode: ChristmasCardLanguageCode
  cardsPerBox: number
  priceCents: number
  isCasePricingEligible: boolean
  sortOrder: number
}

export type ChristmasCardCuratedCase = {
  id: string
  sku: string
  title: string
  description: string
  boxesPerCase: number
  priceCents: number
  components: Array<{
    boxId: string
    quantityBoxes: number
  }>
}

export const CHRISTMAS_CARD_ORDER_CONFIG = {
  brandName: 'Celebrate Christ in Christmas',
  boxesPerCase: 35,
  customLogoSetupFeeCents: 3000,
  customLogoPerBoxFeeCents: 100,
  customLogoFeeCents: 3000,
  currencyCode: 'CAD',
  shippingLabel: 'Shipping to be confirmed before payment',
} as const

export const CHRISTMAS_CARD_BOXES: ChristmasCardBox[] = [
  {
    id: 'mary-gentle-mother',
    sku: 'CIC-MGM',
    title: 'Mary Gentle Mother',
    description: 'A traditional Christmas card box with 12 folded cards and matching envelopes.',
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/mary-gentle-mother-front.jpg',
    insideImageUrl: '/christmas-cards/mary-gentle-mother-inside.jpg',
    outsideImageUrl: '/christmas-cards/mary-gentle-mother-outside.jpg',
    themeTags: ['Madonna & Child'],
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 10,
  },
  {
    id: 'shepherds-adore',
    sku: 'CIC-SA',
    title: 'Shepherds Adore',
    description: 'A traditional Christmas card box with 12 folded cards and matching envelopes.',
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/shepherds-adore-front.jpg',
    insideImageUrl: '/christmas-cards/shepherds-adore-inside.jpg',
    outsideImageUrl: '/christmas-cards/shepherds-adore-outside.jpg',
    themeTags: ['Nativity'],
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 20,
  },
  {
    id: 'star-of-bethlehem',
    sku: 'CIC-SOB',
    title: 'Star of Bethlehem',
    description: 'A traditional Christmas card box with 12 folded cards and matching envelopes.',
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/star-of-bethlehem-front.jpg',
    insideImageUrl: '/christmas-cards/star-of-bethlehem-inside.jpg',
    outsideImageUrl: '/christmas-cards/star-of-bethlehem-outside.jpg',
    themeTags: ['Nativity', 'Custom category title placeholder 1'],
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 30,
  },
]

export const CHRISTMAS_CARD_CURATED_CASES: ChristmasCardCuratedCase[] = [
  {
    id: 'classic-sacred-case',
    sku: 'CIC-CASE-CLASSIC',
    title: 'Classic Sacred Case',
    description: 'A balanced case of sacred Christmas designs selected for parish, council, and ministry sales.',
    boxesPerCase: 35,
    priceCents: 43500,
    components: [
      { boxId: 'mary-gentle-mother', quantityBoxes: 15 },
      { boxId: 'shepherds-adore', quantityBoxes: 10 },
      { boxId: 'star-of-bethlehem', quantityBoxes: 10 },
    ],
  },
]

export function formatChristmasCardMoney(cents: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: CHRISTMAS_CARD_ORDER_CONFIG.currencyCode,
  }).format(cents / 100)
}
