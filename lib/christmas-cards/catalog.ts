export type ChristmasCardLanguageCode = 'en' | 'fr' | 'pl' | 'es' | 'tl' | 'zh'

export type ChristmasCardCollection = {
  id: string
  title: string
  description: string
  sortOrder: number
}

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
  collectionId: string
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
  boxesPerCase: 32,
  promotionPackageCents: 6500,
  campaignPackageCents: 19500,
  currencyCode: 'CAD',
  shippingLabel: 'Shipping calculated after order review.',
} as const

export const CHRISTMAS_CARD_COLLECTIONS: ChristmasCardCollection[] = [
  {
    id: 'collection-1',
    title: 'Collection 1',
    description: 'Traditional sacred artwork for parish and council Christmas card programs.',
    sortOrder: 10,
  },
  {
    id: 'collection-2',
    title: 'Collection 2',
    description: 'Additional faith-centered Christmas designs for a broader selection.',
    sortOrder: 20,
  },
  {
    id: 'collection-3',
    title: 'Collection 3',
    description: 'More designs will be added as the final card lineup is approved.',
    sortOrder: 30,
  },
  {
    id: 'collection-4',
    title: 'Collection 4',
    description: 'More designs will be added as the final card lineup is approved.',
    sortOrder: 40,
  },
]

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
    collectionId: 'collection-1',
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
    collectionId: 'collection-1',
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
    themeTags: ['Nativity'],
    collectionId: 'collection-1',
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
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/heart-of-mary-front.jpg',
    insideImageUrl: '/christmas-cards/heart-of-mary-inside.jpg',
    outsideImageUrl: '/christmas-cards/heart-of-mary-outside.jpg',
    themeTags: ['Madonna & Child'],
    collectionId: 'collection-1',
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
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/angelic-choir-front.jpg',
    insideImageUrl: '/christmas-cards/angelic-choir-inside.jpg',
    outsideImageUrl: '/christmas-cards/angelic-choir-outside.jpg',
    themeTags: ['Angels'],
    collectionId: 'collection-2',
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
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/madonna-and-child-front.jpg',
    insideImageUrl: '/christmas-cards/madonna-and-child-inside.jpg',
    outsideImageUrl: '/christmas-cards/madonna-and-child-outside.jpg',
    themeTags: ['Madonna & Child'],
    collectionId: 'collection-2',
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
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/the-nativity-front.jpg',
    insideImageUrl: '/christmas-cards/the-nativity-inside.jpg',
    outsideImageUrl: '/christmas-cards/the-nativity-outside.jpg',
    themeTags: ['Nativity'],
    collectionId: 'collection-2',
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
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/child-of-wonder-front.jpg',
    insideImageUrl: '/christmas-cards/child-of-wonder-inside.jpg',
    outsideImageUrl: '/christmas-cards/child-of-wonder-outside.jpg',
    themeTags: ['Holy Family'],
    collectionId: 'collection-2',
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 80,
  },
]

export const CHRISTMAS_CARD_CURATED_CASES: ChristmasCardCuratedCase[] = [
  {
    id: 'classic-sacred-case',
    sku: 'CIC-CASE-CLASSIC',
    title: 'Classic Case of 32 Boxes',
    description: 'A complete Catholic Christmas card fundraising collection for parishes and councils.',
    boxesPerCase: 32,
    priceCents: 44900,
    components: [
      { boxId: 'mary-gentle-mother', quantityBoxes: 4 },
      { boxId: 'shepherds-adore', quantityBoxes: 4 },
      { boxId: 'star-of-bethlehem', quantityBoxes: 4 },
      { boxId: 'heart-of-mary', quantityBoxes: 4 },
      { boxId: 'angelic-choir', quantityBoxes: 4 },
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
