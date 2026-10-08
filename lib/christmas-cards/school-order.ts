import { CHRISTMAS_CARD_MIXED_BOXES } from './catalog'

export const CCIC_SCHOOL_ORDER_DRAFT_STORAGE_KEY = 'ccic-school-order-draft-v1'
export const CCIC_SCHOOL_CHECKOUT_STORAGE_KEY = 'ccic-school-checkout-v1'

export type CcicSchoolOrderDraft = {
  version: 1
  schoolSlug: string
  schoolCode: string
  quantities: Record<string, number>
}

export type CcicSchoolOrderLine = {
  catalogId: string
  sku: string
  title: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

function normalizeQuantity(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(99, Math.floor(value)))
}

export function parseCcicSchoolOrderDraft(value: unknown): CcicSchoolOrderDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Partial<CcicSchoolOrderDraft>
  if (candidate.version !== 1 || typeof candidate.schoolSlug !== 'string' || typeof candidate.schoolCode !== 'string') return null
  const quantities = candidate.quantities && typeof candidate.quantities === 'object' && !Array.isArray(candidate.quantities)
    ? Object.fromEntries(
        Object.entries(candidate.quantities)
          .map(([key, quantity]) => [key, normalizeQuantity(quantity)] as const)
          .filter(([, quantity]) => quantity > 0)
      )
    : {}

  return {
    version: 1,
    schoolSlug: candidate.schoolSlug.trim().toLowerCase(),
    schoolCode: candidate.schoolCode.trim().toUpperCase(),
    quantities,
  }
}

export function calculateCcicSchoolOrder(draft: CcicSchoolOrderDraft) {
  const lines: CcicSchoolOrderLine[] = CHRISTMAS_CARD_MIXED_BOXES.flatMap((item) => {
    const quantity = normalizeQuantity(draft.quantities[item.id])
    if (!quantity) return []
    return [{
      catalogId: item.id,
      sku: item.sku,
      title: item.title,
      quantity,
      unitPriceCents: item.priceCents,
      lineTotalCents: quantity * item.priceCents,
    }]
  })

  const totalBoxes = lines.reduce((sum, line) => sum + line.quantity, 0)
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0)
  const schoolContributionCents = totalBoxes * 450

  return {
    lines,
    totalBoxes,
    subtotalCents,
    totalCents: subtotalCents,
    schoolContributionCents,
    hasOrder: totalBoxes > 0,
  }
}
