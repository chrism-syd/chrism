'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { CHRISTMAS_CARD_BOXES } from '@/lib/christmas-cards/catalog'

function formText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getCatalogItem(catalogId: string) {
  return CHRISTMAS_CARD_BOXES.find((item) => item.id === catalogId) ?? null
}

function finish(message: string) {
  revalidatePath('/ccic')
  revalidatePath('/ccic/admin/store-control')
  redirect(`/ccic/admin/store-control?${message}`)
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
