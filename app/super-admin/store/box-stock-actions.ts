'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

export type BoxStockActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  boxesLeft?: number | null
}

type StoreProductKindRow = {
  id: string
  product_kind: string
  title: string | null
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function nullableNonNegativeWholeNumberValue(formData: FormData, key: string, label: string) {
  const value = textValue(formData, key)
  if (!value) return null

  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be blank or a whole number 0 or higher.`)
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be blank or a whole number 0 or higher.`)
  }

  return parsed
}

async function requireSuperAdminNormalMode() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }
  return permissions
}

export async function updateCardBoxStockStateAction(
  _previousState: BoxStockActionState,
  formData: FormData,
): Promise<BoxStockActionState> {
  const permissions = await requireSuperAdminNormalMode()
  const actorUserId = permissions.authUser!.id
  const productId = textValue(formData, 'product_id')

  if (!productId) {
    return { status: 'error', message: 'We could not tell which card box to update.' }
  }

  try {
    const boxesLeft = nullableNonNegativeWholeNumberValue(formData, 'boxes_left_count', 'Boxes left')
    const admin = createAdminClient()

    const productResponse = await admin
      .from('store_products')
      .select('id, product_kind, title')
      .eq('id', productId)
      .single<StoreProductKindRow>()

    if (productResponse.error) {
      throw new Error(productResponse.error.message)
    }

    if (productResponse.data?.product_kind !== 'christmas_card_box') {
      return { status: 'error', message: 'Only card boxes can have a boxes-left count.' }
    }

    const updateResponse = await admin
      .from('store_products')
      .update({
        boxes_left_count: boxesLeft,
        updated_by_auth_user_id: actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('product_kind', 'christmas_card_box')

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message)
    }

    revalidatePath('/super-admin/store')

    return {
      status: 'success',
      message: `${productResponse.data.title ?? 'Card box'} boxes-left count was updated.`,
      boxesLeft,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('boxes_left_count')) {
      return {
        status: 'error',
        message: 'Apply the admin-only card box stock migration, then retry saving the box count.',
      }
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not update that boxes-left count right now.',
    }
  }
}
