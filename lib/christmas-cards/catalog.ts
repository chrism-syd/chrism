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
  customCasePriceCents: 36480,
  promotionPackageCents: 6500,
  campaignPackageCents: 19500,
  currencyCode: 'CAD',
  shippingLabel: 'Shipping calculated after order review.',
} as const

export const CHRISTMAS_CARD_COLLECTIONS: ChristmasCardCollection[] = [
  {
    id: 'collection-1',
    title: 'Collection 1',
    description: 'Sacred scenes of the Nativity, shepherds, and Magi.',
    sortOrder: 10,
  },
  {
    id: 'collection-2',
    title: 'Collection 2',
    description: 'Holy Family, angelic, and Marian Christmas artwork.',
    sortOrder: 20,
  },
  {
    id: 'collection-3',
    title: 'Collection 3',
    description: 'Watercolour Christmas scenes featuring the Holy Family, Nativity, shepherds, and Magi.',
    sortOrder: 30,
  },
  {
    id: 'collection-4',
    title: 'Collection 4',
    description: 'Contemporary Christmas symbols including a star, tree, ornament, and stocking.',
    sortOrder: 40,
  },
  {
    id: 'catholic-prayer-cards',
    title: 'Catholic Prayer Cards',
    description: 'Sold by the box for $12.00 and not included in case pricing.',
    sortOrder: 50,
  },
]

const CHRISTMAS_CARD_BOX_DESCRIPTION =
  'A Christmas card box with 12 folded cards and matching envelopes.'

function createChristmasCardBox({
  sku,
  title,
  fileStem,
  themeTags,
  collectionId,
  sortOrder,
  priceCents = 1200,
  isCasePricingEligible = true,
}: {
  sku: string
  title: string
  fileStem: string
  themeTags: string[]
  collectionId: string
  sortOrder: number
  priceCents?: number
  isCasePricingEligible?: boolean
}): ChristmasCardBox {
  const imageBaseUrl = `/christmas-cards/${fileStem}`

  return {
    id: sku.toLowerCase(),
    sku,
    title,
    description: CHRISTMAS_CARD_BOX_DESCRIPTION,
    insideMessage: 'View the inside greeting in the gallery.',
    frontImageUrl: `${imageBaseUrl}_cover.jpg`,
    insideImageUrl: `${imageBaseUrl}_inside.jpg`,
    outsideImageUrl: `${imageBaseUrl}_outside.jpg`,
    themeTags,
    collectionId,
    languageCode: 'en',
    cardsPerBox: 12,
    priceCents,
    isCasePricingEligible,
    sortOrder,
  }
}

export const CHRISTMAS_CARD_BOXES: ChristmasCardBox[] = [
  createChristmasCardBox({
    sku: 'CCIC-26-01-AMV',
    title: 'Adoration of the Magi: Venite',
    fileStem: 'CCIC-26-01-AMV_adoration-of-the-magi_venite',
    themeTags: ['Magi'],
    collectionId: 'collection-1',
    sortOrder: 10,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-01-ASA',
    title: 'Adoration of the Shepherds: Adoremus',
    fileStem: 'CCIC-26-01-ASA_adoration-of-the-shepherds_adoremus',
    themeTags: ['Shepherds'],
    collectionId: 'collection-1',
    sortOrder: 20,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-01-ASE',
    title: 'Adoration of the Shepherds: Emmanuel',
    fileStem: 'CCIC-26-01-ASE_adoration-of-the-shepherds_emmanuel',
    themeTags: ['Shepherds'],
    collectionId: 'collection-1',
    sortOrder: 30,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-01-ASG',
    title: 'Angel Appearing to the Shepherds: Gloria',
    fileStem: 'CCIC-26-01-ASG_angel-appearing-to-the-shepherds_gloria',
    themeTags: ['Angels', 'Shepherds'],
    collectionId: 'collection-1',
    sortOrder: 40,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-02-AHF',
    title: 'Holy Family',
    fileStem: 'CCIC-26-02-AHF_holyfamily',
    themeTags: ['Holy Family'],
    collectionId: 'collection-2',
    sortOrder: 50,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-02-SOA',
    title: 'Song of Angels',
    fileStem: 'CCIC-26-02-SOA_song_of_angels',
    themeTags: ['Angels'],
    collectionId: 'collection-2',
    sortOrder: 60,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-02-VAC',
    title: 'Virgin and Child',
    fileStem: 'CCIC-26-02-VAC_virgin-and-child',
    themeTags: ['Madonna & Child'],
    collectionId: 'collection-2',
    sortOrder: 70,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-02-VWA',
    title: 'Virgin with Angels',
    fileStem: 'CCIC-26-02-VWA_virgin-with-angels',
    themeTags: ['Madonna & Child', 'Angels'],
    collectionId: 'collection-2',
    sortOrder: 80,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-03-WCH',
    title: 'Watercolour Holy Family',
    fileStem: 'CCIC-26-03-WCH_watercolour_holyfam',
    themeTags: ['Holy Family', 'Watercolour'],
    collectionId: 'collection-3',
    sortOrder: 90,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-03-WCN',
    title: 'Watercolour Nativity',
    fileStem: 'CCIC-26-03-WCN_watercolour_nativity',
    themeTags: ['Nativity', 'Watercolour'],
    collectionId: 'collection-3',
    sortOrder: 100,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-03-WCS',
    title: 'Watercolour Shepherds',
    fileStem: 'CCIC-26-03-WCS_watercolour_shepherds',
    themeTags: ['Shepherds', 'Watercolour'],
    collectionId: 'collection-3',
    sortOrder: 110,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-03-WCW',
    title: 'Watercolour Wise Men',
    fileStem: 'CCIC-26-03-WCW_watercolour_wisemen',
    themeTags: ['Magi', 'Watercolour'],
    collectionId: 'collection-3',
    sortOrder: 120,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-04-SCS',
    title: 'Christmas Star',
    fileStem: 'CCIC-26-04-SCS_symbols_star',
    themeTags: ['Christmas Symbols'],
    collectionId: 'collection-4',
    sortOrder: 130,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-04-SCT',
    title: 'Christmas Tree',
    fileStem: 'CCIC-26-04-SCT_symbols_tree',
    themeTags: ['Christmas Symbols'],
    collectionId: 'collection-4',
    sortOrder: 140,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-04-SOR',
    title: 'Christmas Ornament',
    fileStem: 'CCIC-26-04-SOR_symbols_ornament',
    themeTags: ['Christmas Symbols'],
    collectionId: 'collection-4',
    sortOrder: 150,
  }),
  createChristmasCardBox({
    sku: 'CCIC-26-04-SST',
    title: 'Christmas Stocking',
    fileStem: 'CCIC-26-04-SST_symbols_stocking',
    themeTags: ['Christmas Symbols'],
    collectionId: 'collection-4',
    sortOrder: 160,
  }),
  createChristmasCardBox({
    sku: 'CC-25-01',
    title: 'Mary Gentle Mother',
    fileStem: 'other/CC-25-01_mary_gentle_mother',
    themeTags: ['Mary'],
    collectionId: 'catholic-prayer-cards',
    sortOrder: 170,
    priceCents: 1200,
    isCasePricingEligible: false,
  }),
  createChristmasCardBox({
    sku: 'CC-25-02',
    title: 'Heart of Mary',
    fileStem: 'other/CC-25-02_heart_of_mary',
    themeTags: ['Mary'],
    collectionId: 'catholic-prayer-cards',
    sortOrder: 180,
    priceCents: 1200,
    isCasePricingEligible: false,
  }),
  createChristmasCardBox({
    sku: 'CC-25-03',
    title: 'Child of Wonder',
    fileStem: 'other/CC-25-03_child_of_wonder',
    themeTags: ['Christ Child'],
    collectionId: 'catholic-prayer-cards',
    sortOrder: 190,
    priceCents: 1200,
    isCasePricingEligible: false,
  }),
  createChristmasCardBox({
    sku: 'CC-25-04',
    title: 'Shepherds Adore',
    fileStem: 'other/CC-25-04_shepherds_adore',
    themeTags: ['Shepherds'],
    collectionId: 'catholic-prayer-cards',
    sortOrder: 200,
    priceCents: 1200,
    isCasePricingEligible: false,
  }),
  createChristmasCardBox({
    sku: 'CC-25-05',
    title: 'Star of Bethlehem',
    fileStem: 'other/CC-25-05_star_of_bethlehem',
    themeTags: ['Bethlehem'],
    collectionId: 'catholic-prayer-cards',
    sortOrder: 210,
    priceCents: 1200,
    isCasePricingEligible: false,
  }),
  createChristmasCardBox({
    sku: 'CC-25-06',
    title: 'Madonna and Child',
    fileStem: 'other/CC-25-06_madonna_and_child',
    themeTags: ['Madonna & Child'],
    collectionId: 'catholic-prayer-cards',
    sortOrder: 220,
    priceCents: 1200,
    isCasePricingEligible: false,
  }),
  createChristmasCardBox({
    sku: 'CC-25-07',
    title: 'The Nativity',
    fileStem: 'other/CC-25-07_the_nativity',
    themeTags: ['Nativity'],
    collectionId: 'catholic-prayer-cards',
    sortOrder: 230,
    priceCents: 1200,
    isCasePricingEligible: false,
  }),
]

export const CHRISTMAS_CARD_CURATED_CASES: ChristmasCardCuratedCase[] = [
  {
    id: 'classic-sacred-case',
    sku: 'CIC-CASE-CLASSIC',
    title: 'Classic Case of 32 Boxes',
    description: 'A complete Catholic Christmas card fundraising collection for parishes and councils.',
    boxesPerCase: 32,
    priceCents: 32640,
    components: CHRISTMAS_CARD_BOXES
      .filter((box) => box.isCasePricingEligible)
      .map((box) => ({
        boxId: box.id,
        quantityBoxes: 2,
      })),
  },
]

export function formatChristmasCardMoney(cents: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: CHRISTMAS_CARD_ORDER_CONFIG.currencyCode,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}
