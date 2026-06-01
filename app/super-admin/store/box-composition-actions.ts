'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

type StoreProductKindRow = {
  id: string
  product_kind: string
  title: string | null
}

type StoreCardDesignRow = {
  id: string
  title: string
  sort_order: number
}

export type BoxCompositionActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  totalCards?: number
}

const REQUIRED_CARDS_PER_BOX = 12

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function nonNegativeWholeNumberValue(formData: FormData, key: string, label: string) {
  const value = textValue(formData, key)
  if (!value) return 0

  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a whole number 0 or higher.`)
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a whole number 0 or higher.`)
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

export async function updateChristmasCardBoxCompositionStateAction(
  _previousState: BoxCompositionActionState,
  formData: FormData,
): Promise<BoxCompositionActionState> {
  const permissions = await requireSuperAdminNormalMode()
  const actorUserId = permissions.authUser!.id
  const boxProductId = textValue(formData, 'box_product_id')

  if (!boxProductId) {
    return {
      status: 'error',
      message: 'We could not tell which card box to update.',
    }
  }

  const admin = createAdminClient()

  try {
    const boxProductResponse = await admin
      .from('store_products')
      .select('id, product_kind, title')
      .eq('id', boxProductId)
      .single<StoreProductKindRow>()

    if (boxProductResponse.error) {
      throw new Error(boxProductResponse.error.message)
    }

    if (boxProductResponse.data?.product_kind !== 'christmas_card_box') {
      return {
        status: 'error',
        message: 'Only Christmas card boxes can contain card designs.',
      }
    }

    const designResponse = await admin
      .from('store_products')
      .select('id, title, sort_order')
      .eq('product_kind', 'christmas_card_design')
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })

    if (designResponse.error) {
      throw new Error(designResponse.error.message)
    }

    const designs = (designResponse.data as StoreCardDesignRow[] | null) ?? []
    if (designs.length === 0) {
      return {
        status: 'error',
        message: 'Add card designs before editing a box composition.',
      }
    }

    let totalCards = 0
    const componentRows = designs.flatMap((design, index) => {
      const quantity = nonNegativeWholeNumberValue(formData, `quantity_${design.id}`, design.title)
      totalCards += quantity
      if (quantity === 0) return []

      return [
        {
          parent_product_id: boxProductId,
          component_product_id: design.id,
          quantity,
          component_role: 'included',
          sort_order: (index + 1) * 10,
          metadata: { unit: 'cards' },
          created_by_auth_user_id: actorUserId,
          updated_by_auth_user_id: actorUserId,
          updated_at: new Date().toISOString(),
        },
      ]
    })

    if (totalCards !== REQUIRED_CARDS_PER_BOX) {
      return {
        status: 'error',
        message: `Card box composition must total exactly ${REQUIRED_CARDS_PER_BOX} cards. This currently totals ${totalCards}.`,
        totalCards,
      }
    }

    const deleteResponse = await admin
      .from('store_product_components')
      .delete()
      .eq('parent_product_id', boxProductId)

    if (deleteResponse.error) {
      throw new Error(deleteResponse.error.message)
    }

    const insertResponse = await admin.from('store_product_components').insert(componentRows)
    if (insertResponse.error) {
      throw new Error(insertResponse.error.message)
    }

    revalidatePath('/super-admin/store')

    return {
      status: 'success',
      message: `${boxProductResponse.data.title ?? 'Card box'} now contains ${totalCards} cards.`,
      totalCards,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not update that box composition right now.',
    }
  }
}
