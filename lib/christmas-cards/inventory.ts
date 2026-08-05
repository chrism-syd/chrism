import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  CHRISTMAS_CARD_BOXES,
  CHRISTMAS_CARD_CURATED_CASES,
} from './catalog'
import type { CcicCalculatedOrder } from './order'

export type CcicStoreAvailability = {
  isStoreEnabled: boolean
  stockOnHand: number | null
  committedBoxes: number
  availableBoxes: number | null
}

export type CcicStoreAvailabilityMap = Record<string, CcicStoreAvailability>

export type CcicInventoryAllocation = {
  catalogId: string
  quantityBoxes: number
}

type InventoryRow = {
  catalog_id: string
  sku: string
  title: string
  stock_on_hand: number | null
  is_store_enabled: boolean
}

type AllocationRow = {
  order_id: string
  catalog_id: string
  quantity_boxes: number
}

type OrderStatusRow = {
  id: string
  status_code: string
}

export function getCcicInventoryCatalogItems() {
  return CHRISTMAS_CARD_BOXES.map((box) => ({
    catalogId: box.id,
    sku: box.sku,
    title: box.title,
  }))
}

export async function syncCcicStoreInventoryCatalog() {
  const items = getCcicInventoryCatalogItems()
  if (!items.length) return

  const admin = createAdminClient()
  const { error } = await admin
    .from('ccic_store_inventory')
    .upsert(
      items.map((item) => ({
        catalog_id: item.catalogId,
        sku: item.sku,
        title: item.title,
      })),
      { onConflict: 'catalog_id' }
    )

  if (error) {
    throw new Error(`Unable to sync CCIC inventory products: ${error.message}`)
  }
}

export async function getCcicStoreAvailabilityMap(): Promise<CcicStoreAvailabilityMap> {
  const admin = createAdminClient()
  const [{ data: inventoryData, error: inventoryError }, { data: allocationData, error: allocationError }] = await Promise.all([
    admin
      .from('ccic_store_inventory')
      .select('catalog_id, sku, title, stock_on_hand, is_store_enabled'),
    admin
      .from('ccic_order_inventory_allocations')
      .select('order_id, catalog_id, quantity_boxes'),
  ])

  if (inventoryError) {
    if (inventoryError.code === '42P01') return {}
    throw new Error(`Unable to load CCIC store inventory: ${inventoryError.message}`)
  }
  if (allocationError) {
    if (allocationError.code === '42P01') return {}
    throw new Error(`Unable to load CCIC inventory commitments: ${allocationError.message}`)
  }

  const allocations = (allocationData ?? []) as AllocationRow[]
  const orderIds = [...new Set(allocations.map((row) => row.order_id))]
  const activeOrderIds = new Set<string>()

  if (orderIds.length) {
    const { data: orderData, error: orderError } = await admin
      .from('ccic_orders')
      .select('id, status_code')
      .in('id', orderIds)

    if (orderError) {
      throw new Error(`Unable to load CCIC inventory order statuses: ${orderError.message}`)
    }

    for (const order of (orderData ?? []) as OrderStatusRow[]) {
      if (order.status_code !== 'cancelled') activeOrderIds.add(order.id)
    }
  }

  const committedByCatalog = new Map<string, number>()
  for (const allocation of allocations) {
    if (!activeOrderIds.has(allocation.order_id)) continue
    committedByCatalog.set(
      allocation.catalog_id,
      (committedByCatalog.get(allocation.catalog_id) ?? 0) + allocation.quantity_boxes
    )
  }

  const availability: CcicStoreAvailabilityMap = {}
  for (const row of (inventoryData ?? []) as InventoryRow[]) {
    const committedBoxes = committedByCatalog.get(row.catalog_id) ?? 0
    availability[row.catalog_id] = {
      isStoreEnabled: row.is_store_enabled,
      stockOnHand: row.stock_on_hand,
      committedBoxes,
      availableBoxes: row.stock_on_hand === null
        ? null
        : Math.max(0, row.stock_on_hand - committedBoxes),
    }
  }

  return availability
}

export function buildCcicOrderInventoryAllocations(calculated: CcicCalculatedOrder) {
  const quantities = new Map<string, number>()

  function add(catalogId: string, quantityBoxes: number) {
    if (!catalogId || quantityBoxes <= 0) return
    quantities.set(catalogId, (quantities.get(catalogId) ?? 0) + quantityBoxes)
  }

  for (const line of calculated.lines) {
    if (line.lineType === 'individual_box') {
      add(line.catalogId, line.quantity)
      continue
    }

    const curatedCase = CHRISTMAS_CARD_CURATED_CASES.find((item) => item.id === line.catalogId)
    if (!curatedCase) continue

    for (const component of curatedCase.components) {
      add(component.boxId, component.quantityBoxes * line.quantity)
    }
  }

  return [...quantities.entries()].map(([catalogId, quantityBoxes]) => ({
    catalogId,
    quantityBoxes,
  })) satisfies CcicInventoryAllocation[]
}

export async function allocateCcicOrderInventory(orderId: string, calculated: CcicCalculatedOrder) {
  const allocations = buildCcicOrderInventoryAllocations(calculated)
  if (!allocations.length) return

  const admin = createAdminClient()
  const { error } = await admin.rpc('ccic_allocate_order_inventory', {
    p_order_id: orderId,
    p_allocations: allocations,
  })

  if (error) throw error
}
