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

type StoreCardBoxRow = {
  id: string
  title: string
  sort_order: number
}

export type CaseCompositionActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  totalBoxes?: number
}

export const initialCaseCompositionActionState: CaseCompositionActionState = {
  status: 'idle',
  message: null,
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === 'on'
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

function isOldCaseShapeConstraintError(error: unknown) {
  return error instanceof Error && error.message.includes('store_products_christmas_card_case_shape')
}

async function requireSuperAdminNormalMode() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }
  return permissions
}

export async function updateChristmasCardCaseCompositionStateAction(
  _previousState: CaseCompositionActionState,
  formData: FormData,
): Promise<CaseCompositionActionState> {
  const permissions = await requireSuperAdminNormalMode()
  const actorUserId = permissions.authUser!.id
  const caseProductId = textValue(formData, 'case_product_id')

  if (!caseProductId) {
    return {
      status: 'error',
      message: 'We could not tell which case to update.',
    }
  }

  if (!checkboxValue(formData, 'confirm_case_box_total')) {
    return {
      status: 'error',
      message: 'Confirm the case box total before saving the case composition.',
    }
  }

  const admin = createAdminClient()

  try {
    const caseProductResponse = await admin
      .from('store_products')
      .select('id, product_kind, title')
      .eq('id', caseProductId)
      .single<StoreProductKindRow>()

    if (caseProductResponse.error) {
      throw new Error(caseProductResponse.error.message)
    }

    if (caseProductResponse.data?.product_kind !== 'christmas_card_case') {
      return {
        status: 'error',
        message: 'Only Christmas card cases can be edited in this section.',
      }
    }

    const boxResponse = await admin
      .from('store_products')
      .select('id, title, sort_order')
      .eq('product_kind', 'christmas_card_box')
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })

    if (boxResponse.error) {
      throw new Error(boxResponse.error.message)
    }

    const boxes = (boxResponse.data as StoreCardBoxRow[] | null) ?? []
    if (boxes.length === 0) {
      return {
        status: 'error',
        message: 'Add at least one Christmas card box before editing case composition.',
      }
    }

    let totalBoxes = 0
    const componentRows = boxes.flatMap((box, index) => {
      const quantity = nonNegativeWholeNumberValue(formData, `quantity_${box.id}`, box.title)
      totalBoxes += quantity
      if (quantity === 0) return []

      return [
        {
          parent_product_id: caseProductId,
          component_product_id: box.id,
          quantity,
          component_role: 'included',
          sort_order: (index + 1) * 10,
          metadata: {},
          created_by_auth_user_id: actorUserId,
          updated_by_auth_user_id: actorUserId,
          updated_at: new Date().toISOString(),
        },
      ]
    })

    if (totalBoxes <= 0) {
      return {
        status: 'error',
        message: 'Case composition must include at least one box.',
      }
    }

    const caseUpdateResponse = await admin
      .from('store_products')
      .update({
        boxes_per_case: totalBoxes,
        updated_by_auth_user_id: actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseProductId)
      .eq('product_kind', 'christmas_card_case')

    if (caseUpdateResponse.error) {
      throw new Error(caseUpdateResponse.error.message)
    }

    const deleteResponse = await admin
      .from('store_product_components')
      .delete()
      .eq('parent_product_id', caseProductId)

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
      message: `${caseProductResponse.data.title ?? 'Case'} now includes ${totalBoxes} boxes.`,
      totalBoxes,
    }
  } catch (error) {
    if (isOldCaseShapeConstraintError(error)) {
      return {
        status: 'error',
        message: 'The database is still enforcing the old case box-count rule. Apply the variable case-count migration, then retry.',
      }
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not update that case composition right now.',
    }
  }
}
