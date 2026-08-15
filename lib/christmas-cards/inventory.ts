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
  reservedBoxes: number
  availableBoxes: number | null
}

export type CcicStoreAvailabilityMap = Record<string, CcicStoreAvailability>

export type CcicInventoryAllocation = {
  catalogId: string
  quantityBoxes: number
}

export type CcicCaseReserve = {
  caseCatalogId: string
  reservedCases: number
  committedCases: number
  availableCases: number
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

type CaseReserveSettingRow = {
  case_catalog_id: string
  reserved_cases: number
}

type CaseReserveComponentRow = {
  case_catalog_id: string
  catalog_id: string
  quantity_per_case: number
}

type ClassicCaseOrderLineRow = {
  order_id: string
  catalog_id: string
  quantity: number
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

async function getCcicReserveState() {
  const admin = createAdminClient()
  const [
    { data: settingsData, error: settingsError },
    { data: componentsData, error: componentsError },
    { data: classicLineData, error: classicLineError },
  ] = await Promise.all([
    admin.from('ccic_case_reserve_settings').select('case_catalog_id, reserved_cases'),
    admin.from('ccic_case_reserve_components').select('case_catalog_id, catalog_id, quantity_per_case'),
    admin.from('ccic_order_lines').select('order_id, catalog_id, quantity').eq('line_type', 'classic_case'),
  ])

  if (settingsError?.code === '42P01' || componentsError?.code === '42P01') {
    return {
      reserves: [] as CcicCaseReserve[],
      reservedBoxesByCatalog: new Map<string, number>(),
    }
  }
  if (settingsError) throw new Error(`Unable to load CCIC case reserve settings: ${settingsError.message}`)
  if (componentsError) throw new Error(`Unable to load CCIC case reserve components: ${componentsError.message}`)
  if (classicLineError) throw new Error(`Unable to load CCIC classic case commitments: ${classicLineError.message}`)

  const classicLines = (classicLineData ?? []) as ClassicCaseOrderLineRow[]
  const classicOrderIds = [...new Set(classicLines.map((row) => row.order_id))]
  const activeClassicOrderIds = new Set<string>()

  if (classicOrderIds.length) {
    const { data: orderData, error: orderError } = await admin
      .from('ccic_orders')
      .select('id, status_code')
      .in('id', classicOrderIds)

    if (orderError) throw new Error(`Unable to load CCIC classic case order statuses: ${orderError.message}`)
    for (const order of (orderData ?? []) as OrderStatusRow[]) {
      if (order.status_code !== 'cancelled') activeClassicOrderIds.add(order.id)
    }
  }

  const committedCasesByCaseCatalog = new Map<string, number>()
  for (const line of classicLines) {
    if (!activeClassicOrderIds.has(line.order_id)) continue
    committedCasesByCaseCatalog.set(
      line.catalog_id,
      (committedCasesByCaseCatalog.get(line.catalog_id) ?? 0) + line.quantity
    )
  }

  const settings = (settingsData ?? []) as CaseReserveSettingRow[]
  const components = (componentsData ?? []) as CaseReserveComponentRow[]
  const reservedBoxesByCatalog = new Map<string, number>()
  const reserves: CcicCaseReserve[] = settings.map((setting) => {
    const committedCases = committedCasesByCaseCatalog.get(setting.case_catalog_id) ?? 0
    const availableCases = Math.max(0, setting.reserved_cases - committedCases)

    for (const component of components.filter((item) => item.case_catalog_id === setting.case_catalog_id)) {
      reservedBoxesByCatalog.set(
        component.catalog_id,
        (reservedBoxesByCatalog.get(component.catalog_id) ?? 0) + availableCases * component.quantity_per_case
      )
    }

    return {
      caseCatalogId: setting.case_catalog_id,
      reservedCases: setting.reserved_cases,
      committedCases,
      availableCases,
    }
  })

  return { reserves, reservedBoxesByCatalog }
}

export async function getCcicCaseReserves() {
  const reserveState = await getCcicReserveState()
  if (!reserveState.reserves.length) return reserveState.reserves

  const availability = await getCcicStoreAvailabilityMap()

  return reserveState.reserves.map((reserve) => {
    const curatedCase = CHRISTMAS_CARD_CURATED_CASES.find((item) => item.id === reserve.caseCatalogId)
    if (!curatedCase) return reserve

    let physicalAvailableCases = 999999
    for (const component of curatedCase.components) {
      const row = availability[component.boxId]
      if (!row || row.stockOnHand === null) continue
      const uncommittedBoxes = Math.max(0, row.stockOnHand - row.committedBoxes)
      physicalAvailableCases = Math.min(
        physicalAvailableCases,
        Math.floor(uncommittedBoxes / component.quantityBoxes)
      )
    }

    return {
      ...reserve,
      availableCases: Math.min(reserve.availableCases, physicalAvailableCases),
    }
  })
}

export async function getCcicStoreAvailabilityMap(): Promise<CcicStoreAvailabilityMap> {
  const admin = createAdminClient()
  const [
    { data: inventoryData, error: inventoryError },
    { data: allocationData, error: allocationError },
    reserveState,
  ] = await Promise.all([
    admin
      .from('ccic_store_inventory')
      .select('catalog_id, sku, title, stock_on_hand, is_store_enabled'),
    admin
      .from('ccic_order_inventory_allocations')
      .select('order_id, catalog_id, quantity_boxes'),
    getCcicReserveState(),
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
    const reservedBoxes = reserveState.reservedBoxesByCatalog.get(row.catalog_id) ?? 0
    availability[row.catalog_id] = {
      isStoreEnabled: row.is_store_enabled,
      stockOnHand: row.stock_on_hand,
      committedBoxes,
      reservedBoxes,
      availableBoxes: row.stock_on_hand === null
        ? null
        : Math.max(0, row.stock_on_hand - committedBoxes - reservedBoxes),
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
