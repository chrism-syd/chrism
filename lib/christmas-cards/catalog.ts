export type ChristmasCardLanguageCode = 'en' | 'fr' | 'pl' | 'es' | 'tl' | 'zh'

export type ChristmasCardDesign = {
  id: string
  sku: string
  title: string
  description: string
  frontImageUrl: string | null
  themeTags: string[]
  styleFamily: string
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
  languageCode: ChristmasCardLanguageCode
  cardsPerBox: number
  priceCents: number
  isCasePricingEligible: boolean
  sortOrder: number
  components: Array<{
    designId: string
    quantityCards: number
  }>
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
  promotionPackageCents: 6500,
  campaignPackageCents: 19500,
  currencyCode: 'CAD',
  shippingLabel: 'Shipping calculated after order review.',
} as const

export const CHRISTMAS_CARD_DESIGNS: ChristmasCardDesign[] = [
  {
    id: 'watercolour-mary-gentle-mother',
    sku: 'CIC-D-WC-MGM',
    title: 'Mary Gentle Mother',
    description: 'Watercolour-style Christmas card design featuring Mary and the Christ Child.',
    frontImageUrl: '/christmas-cards/watercolour-mary-gentle-mother-front.jpg',
    themeTags: ['Watercolour', 'Madonna & Child'],
    styleFamily: 'watercolour',
    sortOrder: 10,
  },
  {
    id: 'watercolour-shepherds-adore',
    sku: 'CIC-D-WC-SA',
    title: 'Shepherds Adore',
    description: 'Watercolour-style Christmas card design with shepherds at the Nativity.',
    frontImageUrl: '/christmas-cards/watercolour-shepherds-adore-front.jpg',
    themeTags: ['Watercolour', 'Nativity'],
    styleFamily: 'watercolour',
    sortOrder: 20,
  },
  {
    id: 'watercolour-star-of-bethlehem',
    sku: 'CIC-D-WC-SOB',
    title: 'Star of Bethlehem',
    description: 'Watercolour-style Christmas card design inspired by the Bethlehem star.',
    frontImageUrl: '/christmas-cards/watercolour-star-of-bethlehem-front.jpg',
    themeTags: ['Watercolour', 'Nativity'],
    styleFamily: 'watercolour',
    sortOrder: 30,
  },
  {
    id: 'watercolour-child-of-wonder',
    sku: 'CIC-D-WC-COW',
    title: 'Child of Wonder',
    description: 'Watercolour-style Christmas card design centered on the Christ Child.',
    frontImageUrl: '/christmas-cards/watercolour-child-of-wonder-front.jpg',
    themeTags: ['Watercolour', 'Christ Child'],
    styleFamily: 'watercolour',
    sortOrder: 40,
  },
  {
    id: 'foil-venite-adoration',
    sku: 'CIC-D-FOIL-VENITE',
    title: 'Venite Adoration',
    description: 'Artwork-forward Christmas card design with a foil-stamped word treatment.',
    frontImageUrl: '/christmas-cards/foil-venite-adoration-front.jpg',
    themeTags: ['Foil word', 'Adoration'],
    styleFamily: 'foil-word',
    sortOrder: 50,
  },
  {
    id: 'foil-gloria-nativity',
    sku: 'CIC-D-FOIL-GLORIA',
    title: 'Gloria Nativity',
    description: 'Foil-word Christmas card design for a classic Nativity artwork direction.',
    frontImageUrl: '/christmas-cards/foil-gloria-nativity-front.jpg',
    themeTags: ['Foil word', 'Nativity'],
    styleFamily: 'foil-word',
    sortOrder: 60,
  },
  {
    id: 'foil-emmanuel-mother-child',
    sku: 'CIC-D-FOIL-EMMANUEL',
    title: 'Emmanuel Mother and Child',
    description: 'Foil-word Christmas card design focused on Mary and the Christ Child.',
    frontImageUrl: '/christmas-cards/foil-emmanuel-mother-child-front.jpg',
    themeTags: ['Foil word', 'Madonna & Child'],
    styleFamily: 'foil-word',
    sortOrder: 70,
  },
  {
    id: 'foil-noel-sacred-family',
    sku: 'CIC-D-FOIL-NOEL',
    title: 'Noel Sacred Family',
    description: 'Foil-word Christmas card design with a sacred family theme.',
    frontImageUrl: '/christmas-cards/foil-noel-sacred-family-front.jpg',
    themeTags: ['Foil word', 'Holy Family'],
    styleFamily: 'foil-word',
    sortOrder: 80,
  },
  {
    id: 'sacred-art-angel-annunciation',
    sku: 'CIC-D-ART-ANGEL',
    title: 'Angel of the Annunciation',
    description: 'Sacred artwork Christmas card design based on historic stained glass.',
    frontImageUrl: '/christmas-cards/sacred-art-angel-annunciation-front.jpg',
    themeTags: ['Sacred artwork', 'Stained glass'],
    styleFamily: 'sacred-artwork',
    sortOrder: 90,
  },
  {
    id: 'sacred-art-nativity-triptych',
    sku: 'CIC-D-ART-TRIPTYCH',
    title: 'Nativity Triptych',
    description: 'Sacred artwork Christmas card design inspired by a framed Nativity triptych.',
    frontImageUrl: '/christmas-cards/sacred-art-nativity-triptych-front.jpg',
    themeTags: ['Sacred artwork', 'Triptych'],
    styleFamily: 'sacred-artwork',
    sortOrder: 100,
  },
  {
    id: 'sacred-art-madonna-panel',
    sku: 'CIC-D-ART-MADONNA',
    title: 'Madonna Panel',
    description: 'Sacred artwork Christmas card design based on a physical devotional artwork.',
    frontImageUrl: '/christmas-cards/sacred-art-madonna-panel-front.jpg',
    themeTags: ['Sacred artwork', 'Madonna & Child'],
    styleFamily: 'sacred-artwork',
    sortOrder: 110,
  },
  {
    id: 'sacred-art-holy-family-frame',
    sku: 'CIC-D-ART-FRAME',
    title: 'Holy Family Frame',
    description: 'Sacred artwork Christmas card design inspired by framed religious art.',
    frontImageUrl: '/christmas-cards/sacred-art-holy-family-frame-front.jpg',
    themeTags: ['Sacred artwork', 'Holy Family'],
    styleFamily: 'sacred-artwork',
    sortOrder: 120,
  },
  {
    id: 'modern-icons-faith-hope-peace',
    sku: 'CIC-D-MOD-FHP',
    title: 'Faith, Hope, and Peace',
    description: 'Modern Christmas icon design with Catholic imagery inside seasonal forms.',
    frontImageUrl: '/christmas-cards/modern-icons-faith-hope-peace-front.jpg',
    themeTags: ['Modern icons', 'Faith Hope Peace'],
    styleFamily: 'modern-icons',
    sortOrder: 130,
  },
  {
    id: 'modern-icons-sacred-tree',
    sku: 'CIC-D-MOD-TREE',
    title: 'Sacred Tree',
    description: 'Modern Christmas icon design using Catholic imagery within a Christmas tree motif.',
    frontImageUrl: '/christmas-cards/modern-icons-sacred-tree-front.jpg',
    themeTags: ['Modern icons', 'Christmas tree'],
    styleFamily: 'modern-icons',
    sortOrder: 140,
  },
  {
    id: 'modern-icons-gift-of-christ',
    sku: 'CIC-D-MOD-GIFT',
    title: 'Gift of Christ',
    description: 'Modern Christmas icon design using Catholic imagery within a gift motif.',
    frontImageUrl: '/christmas-cards/modern-icons-gift-of-christ-front.jpg',
    themeTags: ['Modern icons', 'Gift'],
    styleFamily: 'modern-icons',
    sortOrder: 150,
  },
  {
    id: 'modern-icons-ornament-light',
    sku: 'CIC-D-MOD-ORNAMENT',
    title: 'Ornament Light',
    description: 'Modern Christmas icon design using Catholic imagery within an ornament motif.',
    frontImageUrl: '/christmas-cards/modern-icons-ornament-light-front.jpg',
    themeTags: ['Modern icons', 'Ornament'],
    styleFamily: 'modern-icons',
    sortOrder: 160,
  },
]

export const CHRISTMAS_CARD_BOXES: ChristmasCardBox[] = [
  {
    id: 'watercolour-collection-12-pack',
    sku: 'CIC-BOX-WC',
    title: 'Watercolour Collection 12-Pack',
    description: 'A 12-card box with 3 cards each of 4 coordinated watercolour-style designs and matching envelopes.',
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/watercolour-collection-front.jpg',
    insideImageUrl: '/christmas-cards/watercolour-collection-inside.jpg',
    outsideImageUrl: '/christmas-cards/watercolour-collection-outside.jpg',
    themeTags: ['Watercolour', 'Nativity', 'Madonna & Child'],
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 10,
    components: [
      { designId: 'watercolour-mary-gentle-mother', quantityCards: 3 },
      { designId: 'watercolour-shepherds-adore', quantityCards: 3 },
      { designId: 'watercolour-star-of-bethlehem', quantityCards: 3 },
      { designId: 'watercolour-child-of-wonder', quantityCards: 3 },
    ],
  },
  {
    id: 'foil-word-collection-12-pack',
    sku: 'CIC-BOX-FOIL',
    title: 'Foil Word Collection 12-Pack',
    description: 'A 12-card box with 3 cards each of 4 coordinated designs, including a foil-stamped word treatment.',
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/foil-word-collection-front.jpg',
    insideImageUrl: '/christmas-cards/foil-word-collection-inside.jpg',
    outsideImageUrl: '/christmas-cards/foil-word-collection-outside.jpg',
    themeTags: ['Foil word', 'Nativity', 'Adoration'],
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 20,
    components: [
      { designId: 'foil-venite-adoration', quantityCards: 3 },
      { designId: 'foil-gloria-nativity', quantityCards: 3 },
      { designId: 'foil-emmanuel-mother-child', quantityCards: 3 },
      { designId: 'foil-noel-sacred-family', quantityCards: 3 },
    ],
  },
  {
    id: 'sacred-artwork-collection-12-pack',
    sku: 'CIC-BOX-ART',
    title: 'Sacred Artwork Collection 12-Pack',
    description: 'A 12-card box with 3 cards each of 4 designs inspired by stained glass, frames, triptychs, and sacred artwork.',
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/sacred-artwork-collection-front.jpg',
    insideImageUrl: '/christmas-cards/sacred-artwork-collection-inside.jpg',
    outsideImageUrl: '/christmas-cards/sacred-artwork-collection-outside.jpg',
    themeTags: ['Sacred artwork', 'Stained glass', 'Triptych'],
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 30,
    components: [
      { designId: 'sacred-art-angel-annunciation', quantityCards: 3 },
      { designId: 'sacred-art-nativity-triptych', quantityCards: 3 },
      { designId: 'sacred-art-madonna-panel', quantityCards: 3 },
      { designId: 'sacred-art-holy-family-frame', quantityCards: 3 },
    ],
  },
  {
    id: 'modern-icons-collection-12-pack',
    sku: 'CIC-BOX-MOD',
    title: 'Modern Icons Collection 12-Pack',
    description: 'A 12-card box with 3 cards each of 4 modern Christmas icon designs with Catholic imagery.',
    insideMessage: 'Inside greeting preview to be added.',
    frontImageUrl: '/christmas-cards/modern-icons-collection-front.jpg',
    insideImageUrl: '/christmas-cards/modern-icons-collection-inside.jpg',
    outsideImageUrl: '/christmas-cards/modern-icons-collection-outside.jpg',
    themeTags: ['Modern icons', 'Catholic imagery'],
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents: 1300,
    isCasePricingEligible: true,
    sortOrder: 40,
    components: [
      { designId: 'modern-icons-faith-hope-peace', quantityCards: 3 },
      { designId: 'modern-icons-sacred-tree', quantityCards: 3 },
      { designId: 'modern-icons-gift-of-christ', quantityCards: 3 },
      { designId: 'modern-icons-ornament-light', quantityCards: 3 },
    ],
  },
]

export const CHRISTMAS_CARD_CURATED_CASES: ChristmasCardCuratedCase[] = [
  {
    id: 'classic-sacred-case',
    sku: 'CIC-CASE-CLASSIC',
    title: 'Classic Sacred Case',
    description: 'A complete Catholic Christmas card fundraising collection for parishes and councils.',
    boxesPerCase: 35,
    priceCents: 44900,
    components: [
      { boxId: 'watercolour-collection-12-pack', quantityBoxes: 9 },
      { boxId: 'foil-word-collection-12-pack', quantityBoxes: 9 },
      { boxId: 'sacred-artwork-collection-12-pack', quantityBoxes: 9 },
      { boxId: 'modern-icons-collection-12-pack', quantityBoxes: 8 },
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
