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

const CARD_BOX_MEDIA_KINDS = ['front', 'inside', 'outside'] as const

type CardBoxMediaKind = (typeof CARD_BOX_MEDIA_KINDS)[number]

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function intValue(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === 'on'
}

function redirectToStore(args: { error?: string | null; notice?: string | null }): never {
  const params = new URLSearchParams()
  if (args.error) params.set('error', args.error)
  if (args.notice) params.set('notice', args.notice)
  redirect(params.size > 0 ? `/super-admin/store?${params.toString()}` : '/super-admin/store')
}

async function requireSuperAdminNormalMode() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }
  return permissions
}

function validatedStatusCode(value: string | null) {
  if (value === 'draft' || value === 'active' || value === 'archived') {
    return value
  }
  return 'draft'
}

function mediaRowsForCardBox(args: {
  productId: string
  title: string
  actorUserId: string
  formData: FormData
}) {
  return CARD_BOX_MEDIA_KINDS.flatMap((mediaKind, index) => {
    const publicUrl = textValue(args.formData, `${mediaKind}_image_url`)
    if (!publicUrl) return []

    return [
      {
        product_id: args.productId,
        media_kind: mediaKind,
        public_url: publicUrl,
        alt_text: `${args.title} ${mediaKind}`,
        sort_order: (index + 1) * 10,
        is_primary: mediaKind === 'front',
        metadata: {},
        created_by_auth_user_id: args.actorUserId,
        updated_by_auth_user_id: args.actorUserId,
        updated_at: new Date().toISOString(),
      },
    ]
  })
}

export async function updateChristmasCardBoxProductAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const actorUserId = permissions.authUser!.id
  const productId = textValue(formData, 'product_id')

  if (!productId) {
    redirectToStore({ error: 'We could not tell which card box to update.' })
  }

  const title = textValue(formData, 'title')
  if (!title) {
    redirectToStore({ error: 'Card box title is required.' })
  }

  const admin = createAdminClient()

  try {
    const productResponse = await admin
      .from('store_products')
      .select('id, product_kind, title')
      .eq('id', productId)
      .single<StoreProductKindRow>()

    if (productResponse.error) {
      throw new Error(productResponse.error.message)
    }

    if (productResponse.data?.product_kind !== 'christmas_card_box') {
      redirectToStore({ error: 'Only Christmas card boxes can be edited in this section.' })
    }

    const updateResponse = await admin
      .from('store_products')
      .update({
        title,
        sku: textValue(formData, 'sku'),
        short_description: textValue(formData, 'short_description'),
        description: textValue(formData, 'description'),
        status_code: validatedStatusCode(textValue(formData, 'status_code')),
        is_public: checkboxValue(formData, 'is_public'),
        sort_order: intValue(formData, 'sort_order') ?? 0,
        updated_by_auth_user_id: actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('product_kind', 'christmas_card_box')

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message)
    }

    const mediaDeleteResponse = await admin
      .from('store_product_media')
      .delete()
      .eq('product_id', productId)
      .in('media_kind', [...CARD_BOX_MEDIA_KINDS])

    if (mediaDeleteResponse.error) {
      throw new Error(mediaDeleteResponse.error.message)
    }

    const mediaRows = mediaRowsForCardBox({ productId, title, actorUserId, formData })
    if (mediaRows.length > 0) {
      const mediaInsertResponse = await admin.from('store_product_media').insert(mediaRows)
      if (mediaInsertResponse.error) {
        throw new Error(mediaInsertResponse.error.message)
      }
    }

    revalidatePath('/super-admin/store')
    redirectToStore({ notice: `${title} was updated.` })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update that card box right now.'
    redirectToStore({ error: message })
  }
}
