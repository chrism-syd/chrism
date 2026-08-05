export const CCIC_ORDER_STATUSES = [
  'received',
  'paid',
  'packed',
  'shipped',
  'cancelled',
] as const

export type CcicOrderStatus = (typeof CCIC_ORDER_STATUSES)[number]

export const CCIC_ORDER_STATUS_LABELS: Record<CcicOrderStatus, string> = {
  received: 'Order received',
  paid: 'Order paid',
  packed: 'Order packed',
  shipped: 'Order shipped',
  cancelled: 'Cancelled',
}

export const CCIC_ORDER_STATUS_RANK: Record<CcicOrderStatus, number> = {
  received: 0,
  paid: 1,
  packed: 2,
  shipped: 3,
  cancelled: 4,
}

export function isCcicOrderStatus(value: unknown): value is CcicOrderStatus {
  return typeof value === 'string'
    && (CCIC_ORDER_STATUSES as readonly string[]).includes(value)
}

export function getCcicOrderStatusLabel(value: string) {
  return isCcicOrderStatus(value) ? CCIC_ORDER_STATUS_LABELS[value] : value
}
