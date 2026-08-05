import {
  CHRISTMAS_CARD_BOXES,
  CHRISTMAS_CARD_CURATED_CASES,
  CHRISTMAS_CARD_ORDER_CONFIG,
} from './catalog'

export const CCIC_ORDER_DRAFT_STORAGE_KEY = 'ccic-order-draft-v1'
export const CCIC_SHIPPING_RATE_CENTS = 3600

export type CcicFulfillmentMethod = 'pickup' | 'shipping'

export type CcicOrderDraftInput = {
  version: 1
  caseQuantities: Record<string, number>
  boxQuantities: Record<string, number>
  fulfillmentMethod: CcicFulfillmentMethod
}

export type CcicCalculatedLine = {
  lineType: 'classic_case' | 'individual_box'
  catalogId: string
  sku: string
  title: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
  boxesPerUnit: number
}

export type CcicCalculatedOrder = {
  input: CcicOrderDraftInput
  lines: CcicCalculatedLine[]
  regularSubtotalCents: number
  customCaseCount: number
  customCaseSubtotalCents: number
  customCaseDiscountCents: number
  subtotalCents: number
  shippingCents: number
  totalCents: number
  totalSelectedBoxes: number
  totalSelectedCases: number
  remainingLooseBoxes: number
  currentCaseProgress: number
  boxesUntilNextCase: number
  hasOrder: boolean
}

function normalizeQuantity(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(999, Math.floor(value)))
}

function normalizeQuantityMap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, quantity]) => [key, normalizeQuantity(quantity)] as const)
      .filter(([, quantity]) => quantity > 0)
  )
}

export function parseCcicOrderDraftInput(value: unknown): CcicOrderDraftInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const candidate = value as Partial<CcicOrderDraftInput>
  const fulfillmentMethod = candidate.fulfillmentMethod === 'shipping' ? 'shipping' : 'pickup'

  return {
    version: 1,
    caseQuantities: normalizeQuantityMap(candidate.caseQuantities),
    boxQuantities: normalizeQuantityMap(candidate.boxQuantities),
    fulfillmentMethod,
  }
}

export function calculateCcicOrder(input: CcicOrderDraftInput): CcicCalculatedOrder {
  const normalizedInput = parseCcicOrderDraftInput(input) ?? {
    version: 1 as const,
    caseQuantities: {},
    boxQuantities: {},
    fulfillmentMethod: 'pickup' as const,
  }

  const classicLines: CcicCalculatedLine[] = CHRISTMAS_CARD_CURATED_CASES.flatMap((item) => {
    const quantity = normalizeQuantity(normalizedInput.caseQuantities[item.id])
    if (!quantity) return []

    return [{
      lineType: 'classic_case' as const,
      catalogId: item.id,
      sku: item.sku,
      title: item.title,
      quantity,
      unitPriceCents: item.priceCents,
      lineTotalCents: quantity * item.priceCents,
      boxesPerUnit: item.boxesPerCase,
    }]
  })

  const individualLines: CcicCalculatedLine[] = CHRISTMAS_CARD_BOXES.flatMap((item) => {
    const quantity = normalizeQuantity(normalizedInput.boxQuantities[item.id])
    if (!quantity) return []

    return [{
      lineType: 'individual_box' as const,
      catalogId: item.id,
      sku: item.sku,
      title: item.title,
      quantity,
      unitPriceCents: item.priceCents,
      lineTotalCents: quantity * item.priceCents,
      boxesPerUnit: 1,
    }]
  })

  const caseEligibleBoxIds = new Set(
    CHRISTMAS_CARD_BOXES
      .filter((item) => item.isCasePricingEligible)
      .map((item) => item.id)
  )
  const caseEligibleIndividualLines = individualLines.filter((line) => caseEligibleBoxIds.has(line.catalogId))
  const lines = [...classicLines, ...individualLines]
  const caseEligibleBoxCount = caseEligibleIndividualLines.reduce((sum, line) => sum + line.quantity, 0)
  const customCaseCount = Math.floor(caseEligibleBoxCount / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase)
  const remainingLooseBoxes = caseEligibleBoxCount % CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
  const classicSubtotalCents = classicLines.reduce((sum, line) => sum + line.lineTotalCents, 0)
  const individualRegularSubtotalCents = individualLines.reduce((sum, line) => sum + line.lineTotalCents, 0)
  const regularSubtotalCents = classicSubtotalCents + individualRegularSubtotalCents
  const customCaseSubtotalCents = customCaseCount * CHRISTMAS_CARD_ORDER_CONFIG.customCasePriceCents
  const individualBoxPriceCents = CHRISTMAS_CARD_BOXES.find((item) => item.isCasePricingEligible)?.priceCents ?? 0
  const completeCustomCasesAtRetailCents = customCaseCount
    * CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
    * individualBoxPriceCents
  const customCaseDiscountCents = Math.max(
    0,
    completeCustomCasesAtRetailCents - customCaseSubtotalCents
  )
  const subtotalCents = regularSubtotalCents - customCaseDiscountCents
  const hasOrder = subtotalCents > 0
  const shippingCents = hasOrder && normalizedInput.fulfillmentMethod === 'shipping'
    ? CCIC_SHIPPING_RATE_CENTS
    : 0
  const totalCents = subtotalCents + shippingCents
  const totalSelectedBoxes = lines.reduce(
    (sum, line) => sum + line.quantity * line.boxesPerUnit,
    0
  )
  const classicCaseCount = classicLines.reduce((sum, line) => sum + line.quantity, 0)
  const currentCaseProgress = caseEligibleBoxCount > 0 && remainingLooseBoxes === 0
    ? CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
    : remainingLooseBoxes
  const boxesUntilNextCase = remainingLooseBoxes === 0
    ? 0
    : CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase - remainingLooseBoxes

  return {
    input: normalizedInput,
    lines,
    regularSubtotalCents,
    customCaseCount,
    customCaseSubtotalCents,
    customCaseDiscountCents,
    subtotalCents,
    shippingCents,
    totalCents,
    totalSelectedBoxes,
    totalSelectedCases: classicCaseCount + customCaseCount,
    remainingLooseBoxes,
    currentCaseProgress,
    boxesUntilNextCase,
    hasOrder,
  }
}
