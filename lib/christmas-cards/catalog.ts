export type ChristmasCardLanguageCode = 'en' | 'fr' | 'pl' | 'es' | 'tl' | 'zh'

export type ChristmasCardBox = {
  id: string
  sku: string
  title: string
  description: string
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
  customLogoFeeCents: 2500,
  currencyCode: 'CAD',
  shippingLabel: 'Shipping to be confirmed before payment',
} as const

export const CHRISTMAS_CARD_BOXES: ChristmasCardBox[] = [
  {
    id: 'mary-gentle-mother',
    sku: 'CIC-MGM',
    title: 'Mary Gentle Mother',
    description: 'A traditional Christmas card box with 12 folded cards and matching envelopes.',
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
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 30,
  },
  {
    id: 'heart-of-mary',
    sku: 'CIC-HOM',
    title: 'Heart of Mary',
    description: 'A traditional Christmas card box with 12 folded cards and matching envelopes.',
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 40,
  },
  {
    id: 'angelic-choir',
    sku: 'CIC-AC',
    title: 'Angelic Choir',
    description: 'A traditional Christmas card box with 12 folded cards and matching envelopes.',
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 50,
  },
  {
    id: 'madonna-and-child',
    sku: 'CIC-MAC',
    title: 'Madonna and Child',
    description: 'A traditional Christmas card box with 12 folded cards and matching envelopes.',
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 60,
  },
  {
    id: 'the-nativity',
    sku: 'CIC-TN',
    title: 'The Nativity',
    description: 'A traditional Christmas card box with 12 folded cards and matching envelopes.',
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 70,
  },
  {
    id: 'child-of-wonder',
    sku: 'CIC-COW',
    title: 'Child of Wonder',
    description: 'A traditional Christmas card box with 12 folded cards and matching envelopes.',
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 80,
  },
]

export const CHRISTMAS_CARD_CURATED_CASES: ChristmasCardCuratedCase[] = [
  {
    id: 'cic2025-curated-case',
    sku: 'CIC2025',
    title: 'CIC2025 Ready-Made Case',
    description: 'A ready-made 35-box case with a balanced selection of English Christmas card designs.',
    boxesPerCase: 35,
    priceCents: 43500,
    components: [
      { boxId: 'mary-gentle-mother', quantityBoxes: 4 },
      { boxId: 'shepherds-adore', quantityBoxes: 4 },
      { boxId: 'star-of-bethlehem', quantityBoxes: 5 },
      { boxId: 'heart-of-mary', quantityBoxes: 5 },
      { boxId: 'angelic-choir', quantityBoxes: 5 },
      { boxId: 'madonna-and-child', quantityBoxes: 4 },
      { boxId: 'the-nativity', quantityBoxes: 4 },
      { boxId: 'child-of-wonder', quantityBoxes: 4 },
    ],
  },
]

export function formatChristmasCardMoney(cents: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: CHRISTMAS_CARD_ORDER_CONFIG.currencyCode,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
