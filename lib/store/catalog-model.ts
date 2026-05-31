export type StoreProductKind =
  | 'christmas_card_box'
  | 'christmas_card_set'
  | 'christmas_card_case'
  | 'store_add_on'
  | 'physical_item'

export type StoreProductStatusCode = 'draft' | 'active' | 'archived'

export type StoreCategorySeed = {
  legacyKey: string
  slug: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  metadata: Record<string, unknown>
}

export type StoreProductSeed = {
  legacyKey: string
  categoryLegacyKey: string
  slug: string
  sku: string | null
  productKind: StoreProductKind
  title: string
  shortDescription: string | null
  description: string | null
  priceCents: number
  currencyCode: string
  statusCode: StoreProductStatusCode
  isPublic: boolean
  sortOrder: number
  cardsPerBox: number | null
  envelopesPerBox: number | null
  boxesPerCase: number | null
  metadata: Record<string, unknown>
}

export type StoreProductComponentSeed = {
  parentProductLegacyKey: string
  componentProductLegacyKey: string
  quantity: number
  componentRole: 'included' | 'optional'
  sortOrder: number
  metadata: Record<string, unknown>
}

export type StoreProductMediaSeed = {
  productLegacyKey: string
  mediaKind: 'front' | 'inside' | 'outside' | 'gallery' | 'logo' | 'preview'
  publicUrl: string | null
  altText: string | null
  sortOrder: number
  isPrimary: boolean
  metadata: Record<string, unknown>
}

export type StoreCatalogSeed = {
  categories: StoreCategorySeed[]
  products: StoreProductSeed[]
  components: StoreProductComponentSeed[]
  media: StoreProductMediaSeed[]
}

type ChristmasCardBoxLike = {
  id: string
  sku: string
  title: string
  description: string
  insideMessage: string
  frontImageUrl: string | null
  insideImageUrl: string | null
  outsideImageUrl: string | null
  themeTags: string[]
  languageCode: string
  cardsPerBox: number
  priceCents: number
  isCasePricingEligible: boolean
  sortOrder: number
}

type ChristmasCardCuratedCaseLike = {
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

type ChristmasCardOrderConfigLike = {
  brandName: string
  boxesPerCase: number
  promotionPackageCents: number
  campaignPackageCents: number
  currencyCode: string
  shippingLabel: string
}

export const CCIC_CATEGORY_LEGACY_KEY = 'ccic-christmas-cards'
export const CCIC_CATEGORY_SLUG = 'christmas-cards'
export const CCIC_REQUIRED_CARDS_PER_BOX = 12
export const CCIC_REQUIRED_ENVELOPES_PER_BOX = 12
export const CCIC_REQUIRED_BOXES_PER_CASE = 35
export const CCIC_CLASSIC_SACRED_CASE_PRICE_CENTS = 44900
export const CCIC_PROMOTION_PACKAGE_PRICE_CENTS = 6500
export const CCIC_CAMPAIGN_PACKAGE_PRICE_CENTS = 19500
export const CCIC_SHIPPING_LABEL = 'Shipping calculated after order review.'

export function christmasCardBoxLegacyKey(boxId: string) {
  return `ccic-box:${boxId}`
}

export function christmasCardCaseLegacyKey(caseId: string) {
  return `ccic-case:${caseId}`
}

export function christmasCardAddOnLegacyKey(addOnCode: 'promotion-package' | 'campaign-package') {
  return `ccic-add-on:${addOnCode}`
}

export function assertCcicBoxShape(product: Pick<StoreProductSeed, 'productKind' | 'cardsPerBox' | 'envelopesPerBox' | 'boxesPerCase' | 'title'>) {
  if (product.productKind !== 'christmas_card_box') return
  if (product.cardsPerBox !== CCIC_REQUIRED_CARDS_PER_BOX || product.envelopesPerBox !== CCIC_REQUIRED_ENVELOPES_PER_BOX || product.boxesPerCase !== null) {
    throw new Error(`Invalid CCiC box shape for ${product.title}: boxes must contain 12 cards and 12 envelopes, with no case size set.`)
  }
}

export function assertCcicCaseShape(product: Pick<StoreProductSeed, 'productKind' | 'cardsPerBox' | 'envelopesPerBox' | 'boxesPerCase' | 'title'>) {
  if (product.productKind !== 'christmas_card_case') return
  if (product.boxesPerCase !== CCIC_REQUIRED_BOXES_PER_CASE || product.cardsPerBox !== null || product.envelopesPerBox !== null) {
    throw new Error(`Invalid CCiC case shape for ${product.title}: cases must contain 35 boxes and must not pretend to be a card box.`)
  }
}

export function assertStoreProductShape(product: StoreProductSeed) {
  if (product.priceCents < 0) {
    throw new Error(`Invalid negative price for ${product.title}.`)
  }
  assertCcicBoxShape(product)
  assertCcicCaseShape(product)
}

export function countBoxQuantityForProduct(args: {
  productLegacyKey: string
  products: StoreProductSeed[]
  components: StoreProductComponentSeed[]
}) {
  const productsByKey = new Map(args.products.map((product) => [product.legacyKey, product]))
  const componentsByParentKey = new Map<string, StoreProductComponentSeed[]>()

  for (const component of args.components) {
    const bucket = componentsByParentKey.get(component.parentProductLegacyKey) ?? []
    bucket.push(component)
    componentsByParentKey.set(component.parentProductLegacyKey, bucket)
  }

  function visit(productLegacyKey: string, stack: Set<string>): number {
    if (stack.has(productLegacyKey)) {
      throw new Error(`Store product component cycle detected at ${productLegacyKey}.`)
    }

    const product = productsByKey.get(productLegacyKey)
    if (!product) {
      throw new Error(`Store product component references missing product ${productLegacyKey}.`)
    }

    if (product.productKind === 'christmas_card_box') {
      return 1
    }

    const components = componentsByParentKey.get(productLegacyKey) ?? []
    if (product.productKind === 'christmas_card_set' || product.productKind === 'christmas_card_case') {
      const nextStack = new Set(stack)
      nextStack.add(productLegacyKey)
      return components.reduce(
        (total, component) => total + component.quantity * visit(component.componentProductLegacyKey, nextStack),
        0
      )
    }

    return 0
  }

  return visit(args.productLegacyKey, new Set())
}

export function assertStoreCatalogSeedInvariants(seed: StoreCatalogSeed) {
  const categoryKeys = new Set(seed.categories.map((category) => category.legacyKey))
  const productKeys = new Set(seed.products.map((product) => product.legacyKey))

  for (const product of seed.products) {
    assertStoreProductShape(product)
    if (!categoryKeys.has(product.categoryLegacyKey)) {
      throw new Error(`Product ${product.title} references missing category ${product.categoryLegacyKey}.`)
    }
  }

  for (const component of seed.components) {
    if (component.quantity <= 0) {
      throw new Error(`Component quantity must be positive for ${component.parentProductLegacyKey}.`)
    }
    if (component.parentProductLegacyKey === component.componentProductLegacyKey) {
      throw new Error(`Product ${component.parentProductLegacyKey} cannot contain itself.`)
    }
    if (!productKeys.has(component.parentProductLegacyKey)) {
      throw new Error(`Component references missing parent product ${component.parentProductLegacyKey}.`)
    }
    if (!productKeys.has(component.componentProductLegacyKey)) {
      throw new Error(`Component references missing child product ${component.componentProductLegacyKey}.`)
    }
  }

  for (const product of seed.products) {
    if (product.productKind !== 'christmas_card_case') continue
    const boxQuantity = countBoxQuantityForProduct({
      productLegacyKey: product.legacyKey,
      products: seed.products,
      components: seed.components,
    })
    if (boxQuantity !== product.boxesPerCase) {
      throw new Error(`Case ${product.title} contains ${boxQuantity} boxes, expected ${product.boxesPerCase}.`)
    }
  }
}

export function assertChristmasCardOrderConfig(config: ChristmasCardOrderConfigLike) {
  if (config.boxesPerCase !== CCIC_REQUIRED_BOXES_PER_CASE) {
    throw new Error(`CCiC boxesPerCase changed to ${config.boxesPerCase}; expected ${CCIC_REQUIRED_BOXES_PER_CASE}.`)
  }
  if (config.promotionPackageCents !== CCIC_PROMOTION_PACKAGE_PRICE_CENTS) {
    throw new Error(`CCiC Promotion Package changed to ${config.promotionPackageCents}; expected ${CCIC_PROMOTION_PACKAGE_PRICE_CENTS}.`)
  }
  if (config.campaignPackageCents !== CCIC_CAMPAIGN_PACKAGE_PRICE_CENTS) {
    throw new Error(`CCiC Campaign Package changed to ${config.campaignPackageCents}; expected ${CCIC_CAMPAIGN_PACKAGE_PRICE_CENTS}.`)
  }
  if (config.currencyCode !== 'CAD') {
    throw new Error(`CCiC currency changed to ${config.currencyCode}; expected CAD.`)
  }
  if (config.shippingLabel !== CCIC_SHIPPING_LABEL) {
    throw new Error(`CCiC shipping label changed; expected "${CCIC_SHIPPING_LABEL}".`)
  }
}

export function buildChristmasCardStoreCatalogSeed(args: {
  boxes: ChristmasCardBoxLike[]
  curatedCases: ChristmasCardCuratedCaseLike[]
  config: ChristmasCardOrderConfigLike
}): StoreCatalogSeed {
  assertChristmasCardOrderConfig(args.config)

  const categories: StoreCategorySeed[] = [
    {
      legacyKey: CCIC_CATEGORY_LEGACY_KEY,
      slug: CCIC_CATEGORY_SLUG,
      name: 'Christmas Cards',
      description: 'Celebrate Christ in Christmas boxed card catalog.',
      sortOrder: 10,
      isActive: true,
      metadata: { brandName: args.config.brandName },
    },
  ]

  const products: StoreProductSeed[] = []
  const components: StoreProductComponentSeed[] = []
  const media: StoreProductMediaSeed[] = []

  for (const box of args.boxes) {
    if (box.cardsPerBox !== CCIC_REQUIRED_CARDS_PER_BOX) {
      throw new Error(`CCiC box ${box.title} has ${box.cardsPerBox} cards; expected ${CCIC_REQUIRED_CARDS_PER_BOX}.`)
    }

    const legacyKey = christmasCardBoxLegacyKey(box.id)
    products.push({
      legacyKey,
      categoryLegacyKey: CCIC_CATEGORY_LEGACY_KEY,
      slug: box.id,
      sku: box.sku,
      productKind: 'christmas_card_box',
      title: box.title,
      shortDescription: box.description,
      description: box.insideMessage,
      priceCents: box.priceCents,
      currencyCode: args.config.currencyCode,
      statusCode: 'draft',
      isPublic: false,
      sortOrder: box.sortOrder,
      cardsPerBox: CCIC_REQUIRED_CARDS_PER_BOX,
      envelopesPerBox: CCIC_REQUIRED_ENVELOPES_PER_BOX,
      boxesPerCase: null,
      metadata: {
        themeTags: box.themeTags,
        languageCode: box.languageCode,
        isCasePricingEligible: box.isCasePricingEligible,
      },
    })

    const imageEntries = [
      { mediaKind: 'front' as const, publicUrl: box.frontImageUrl, sortOrder: 10, isPrimary: true },
      { mediaKind: 'inside' as const, publicUrl: box.insideImageUrl, sortOrder: 20, isPrimary: false },
      { mediaKind: 'outside' as const, publicUrl: box.outsideImageUrl, sortOrder: 30, isPrimary: false },
    ]

    for (const entry of imageEntries) {
      if (!entry.publicUrl) continue
      media.push({
        productLegacyKey: legacyKey,
        mediaKind: entry.mediaKind,
        publicUrl: entry.publicUrl,
        altText: `${box.title} ${entry.mediaKind}`,
        sortOrder: entry.sortOrder,
        isPrimary: entry.isPrimary,
        metadata: {},
      })
    }
  }

  for (const curatedCase of args.curatedCases) {
    const legacyKey = christmasCardCaseLegacyKey(curatedCase.id)
    products.push({
      legacyKey,
      categoryLegacyKey: CCIC_CATEGORY_LEGACY_KEY,
      slug: curatedCase.id,
      sku: curatedCase.sku,
      productKind: 'christmas_card_case',
      title: curatedCase.title,
      shortDescription: curatedCase.description,
      description: curatedCase.description,
      priceCents: curatedCase.priceCents,
      currencyCode: args.config.currencyCode,
      statusCode: 'draft',
      isPublic: false,
      sortOrder: 100,
      cardsPerBox: null,
      envelopesPerBox: null,
      boxesPerCase: CCIC_REQUIRED_BOXES_PER_CASE,
      metadata: {},
    })

    curatedCase.components.forEach((component, index) => {
      components.push({
        parentProductLegacyKey: legacyKey,
        componentProductLegacyKey: christmasCardBoxLegacyKey(component.boxId),
        quantity: component.quantityBoxes,
        componentRole: 'included',
        sortOrder: (index + 1) * 10,
        metadata: {},
      })
    })
  }

  products.push(
    {
      legacyKey: christmasCardAddOnLegacyKey('promotion-package'),
      categoryLegacyKey: CCIC_CATEGORY_LEGACY_KEY,
      slug: 'promotion-package',
      sku: 'CIC-PROMO-PACKAGE',
      productKind: 'store_add_on',
      title: 'Promotion Package',
      shortDescription: 'Personalization and production setup package for a CCiC fundraising campaign.',
      description: 'Logo integration, custom message, digital proof approval, production setup, formatting, and priority handling for customized orders.',
      priceCents: args.config.promotionPackageCents,
      currencyCode: args.config.currencyCode,
      statusCode: 'draft',
      isPublic: false,
      sortOrder: 200,
      cardsPerBox: null,
      envelopesPerBox: null,
      boxesPerCase: null,
      metadata: {},
    },
    {
      legacyKey: christmasCardAddOnLegacyKey('campaign-package'),
      categoryLegacyKey: CCIC_CATEGORY_LEGACY_KEY,
      slug: 'campaign-package',
      sku: 'CIC-CAMPAIGN-PACKAGE',
      productKind: 'store_add_on',
      title: 'Campaign Package',
      shortDescription: 'Promotional campaign package for a CCiC fundraising campaign.',
      description: 'Everything in the Promotion Package, plus 5 promotional posters and 1 custom graphic for email, bulletin, or social media.',
      priceCents: args.config.campaignPackageCents,
      currencyCode: args.config.currencyCode,
      statusCode: 'draft',
      isPublic: false,
      sortOrder: 210,
      cardsPerBox: null,
      envelopesPerBox: null,
      boxesPerCase: null,
      metadata: {},
    }
  )

  const seed = { categories, products, components, media }
  assertStoreCatalogSeedInvariants(seed)
  return seed
}
