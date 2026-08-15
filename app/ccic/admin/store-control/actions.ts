'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { CHRISTMAS_CARD_BOXES, CHRISTMAS_CARD_CURATED_CASES } from '@/lib/christmas-cards/catalog'
import { getCcicCaseReserves, getCcicStoreAvailabilityMap } from '@/lib/christmas-cards/inventory'

function formText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getCatalogItem(catalogId: string) {
  return CHRISTMAS_CARD_BOXES.find((item) => item.id === catalogId) ?? null
}

function finish(message: string): never {
  revalidatePath('/ccic')
  revalidatePath('/ccic/admin/store-control')
  redirect(`/ccic/admin/store-control?${message}`)
}

async function minimumProtectedStock(catalogId: string) {
  const availability = await getCcicStoreAvailabilityMap()
  const row = availability[catalogId]
  return row ? row.committedBoxes + row.reservedBoxes : 0
}

export async function setCcicInventoryStock(formData: FormData) {
  await requireCcicOrderAdmin('/ccic/admin/store-control')

  const catalogId = formText(formData, 'catalog_id')
  const rawStock = formText(formData, 'stock_on_hand')
  const item = getCatalogItem(catalogId)
  if (!item) finish('error=invalid-product')

  const stockOnHand = rawStock === '' ? null : Number(rawStock)
  if (stockOnHand !== null && (!Number.isInteger(stockOnHand) || stockOnHand < 0 || stockOnHand > 999999)) {
    finish('error=invalid-stock')
  }

  if (stockOnHand !== null) {
    const protectedStock = await minimumProtectedStock(catalogId)
    if (stockOnHand < protectedStock) finish('error=stock-below-reserve')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ccic_store_inventory')
    .upsert({
      catalog_id: item.id,
      sku: item.sku,
      title: item.title,
      stock_on_hand: stockOnHand,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'catalog_id' })

  if (error) {
    console.error('CCIC inventory stock update failed', error)
    finish('error=stock-update')
  }

  finish('updated=stock')
}

export async function adjustCcicInventoryStock(formData: FormData) {
  await requireCcicOrderAdmin('/ccic/admin/store-control')

  const catalogId = formText(formData, 'catalog_id')
  const adjustment = Number(formText(formData, 'adjustment'))
  const item = getCatalogItem(catalogId)
  if (!item) finish('error=invalid-product')
  if (!Number.isInteger(adjustment) || adjustment === 0 || Math.abs(adjustment) > 999999) {
    finish('error=invalid-adjustment')
  }

  const admin = createAdminClient()
  const { data, error: readError } = await admin
    .from('ccic_store_inventory')
    .select('stock_on_hand')
    .eq('catalog_id', catalogId)
    .maybeSingle()

  if (readError) {
    console.error('CCIC inventory stock read failed', readError)
    finish('error=stock-update')
  }

  if (!data || data.stock_on_hand === null) finish('error=set-stock-first')

  const nextStock = Number(data.stock_on_hand) + adjustment
  if (nextStock < 0) finish('error=negative-stock')

  const protectedStock = await minimumProtectedStock(catalogId)
  if (nextStock < protectedStock) finish('error=stock-below-reserve')

  const { error } = await admin
    .from('ccic_store_inventory')
    .update({
      stock_on_hand: nextStock,
      updated_at: new Date().toISOString(),
    })
    .eq('catalog_id', catalogId)

  if (error) {
    console.error('CCIC inventory stock adjustment failed', error)
    finish('error=stock-update')
  }

  finish('updated=adjustment')
}

export async function toggleCcicInventoryStore(formData: FormData) {
  await requireCcicOrderAdmin('/ccic/admin/store-control')

  const catalogId = formText(formData, 'catalog_id')
  const enabled = formText(formData, 'enabled') === '1'
  const item = getCatalogItem(catalogId)
  if (!item) finish('error=invalid-product')

  const admin = createAdminClient()
  const { error } = await admin
    .from('ccic_store_inventory')
    .upsert({
      catalog_id: item.id,
      sku: item.sku,
      title: item.title,
      is_store_enabled: enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'catalog_id' })

  if (error) {
    console.error('CCIC inventory store toggle failed', error)
    finish('error=store-toggle')
  }

  finish(`updated=${enabled ? 'enabled' : 'disabled'}`)
}

export async function setCcicClassicCaseReserve(formData: FormData) {
  await requireCcicOrderAdmin('/ccic/admin/store-control')

  const caseCatalogId = formText(formData, 'case_catalog_id')
  const reservedCases = Number(formText(formData, 'reserved_cases'))
  const curatedCase = CHRISTMAS_CARD_CURATED_CASES.find((item) => item.id === caseCatalogId)

  if (!curatedCase) finish('error=invalid-case')
  if (!Number.isInteger(reservedCases) || reservedCases < 0 || reservedCases > 999999) {
    finish('error=invalid-reserve')
  }

  const [reserves, availability] = await Promise.all([
    getCcicCaseReserves(),
    getCcicStoreAvailabilityMap(),
  ])
  const currentReserve = reserves.find((item) => item.caseCatalogId === caseCatalogId)
  const committedCases = currentReserve?.committedCases ?? 0

  if (reservedCases < committedCases) finish('error=reserve-below-committed')

  let maxReservableCases = 999999
  for (const component of curatedCase.components) {
    const row = availability[component.boxId]
    if (!row || row.stockOnHand === null) continue
    const uncommittedBoxes = Math.max(0, row.stockOnHand - row.committedBoxes)
    const componentCapacity = committedCases + Math.floor(uncommittedBoxes / component.quantityBoxes)
    maxReservableCases = Math.min(maxReservableCases, componentCapacity)
  }

  if (reservedCases > maxReservableCases) finish('error=reserve-exceeds-stock')

  const admin = createAdminClient()
  const { error } = await admin
    .from('ccic_case_reserve_settings')
    .upsert({
      case_catalog_id: caseCatalogId,
      reserved_cases: reservedCases,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'case_catalog_id' })

  if (error) {
    console.error('CCIC case reserve update failed', error)
    finish('error=reserve-update')
  }

  finish('updated=reserve')
}
