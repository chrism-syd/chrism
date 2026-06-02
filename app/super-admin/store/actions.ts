'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

type StoreProductKindRow = {
  id: string
  product_kind: string
  title: string | null
  boxes_per_case: number | null
  metadata?: Record<string, unknown> | null
}

type StoreCardBoxRow = {
  id: string
  title: string
  sort_order: number
}

const CCIC_CATEGORY_SLUG = 'christmas-cards'
const CARD_BOX_MEDIA_KINDS = ['front', 'inside', 'outside'] as const
const CARD_DESIGN_MEDIA_KINDS = ['front'] as const

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

function priceCentsValue(formData: FormData, key: string, label = 'Price') {
  const value = textValue(formData, key)
  if (!value) {
    throw new Error(`${label} is required.`)
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(`${label} must be a positive dollar amount with no more than 2 decimal places.`)
  }

  const cents = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`${label} must be a valid positive dollar amount.`)
  }

  return cents
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === 'on'
}

function isNextRedirectError(error: unknown) {
  return (
    typeof error === 'object'
    && error !== null
    && 'digest' in error
    && typeof (error as { digest?: unknown }).digest === 'string'
    && (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    || 'untitled'
}

function datedSlug(prefix: string) {
  return `${prefix}-${Date.now()}`
}

function redirectToStore(args: { error?: string | null; notice?: string | null; target?: string | null }): never {
  const params = new URLSearchParams()
  if (args.error) params.set('error', args.error)
  if (args.notice) params.set('notice', args.notice)
  if (args.target) params.set('target', args.target)
  redirect(params.size > 0 ? `/super-admin/store?${params.toString()}` : '/super-admin/store')
}

function errorMessageForStore(error: unknown, fallback: string) {
  if (isNextRedirectError(error)) {
    throw error
  }

  if (error instanceof Error && error.message.includes('store_products_christmas_card_case_shape')) {
    return 'The database is still enforcing the old case box-count rule. Apply the variable case-count migration, then retry.'
  }

  return error instanceof Error ? error.message : fallback
}

async function requireSuperAdminNormalMode() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }
  return permissions
}

async function getCcicCategoryId(admin: ReturnType<typeof createAdminClient>) {
  const categoryResponse = await admin
    .from('store_categories')
    .select('id')
    .eq('slug', CCIC_CATEGORY_SLUG)
    .single<{ id: string }>()

  if (categoryResponse.error) {
    throw new Error(`Could not load the Christmas Cards category: ${categoryResponse.error.message}`)
  }

  return categoryResponse.data.id
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

function mediaRowsForCardDesign(args: {
  productId: string
  title: string
  actorUserId: string
  formData: FormData
}) {
  return CARD_DESIGN_MEDIA_KINDS.flatMap((mediaKind, index) => {
    const publicUrl = textValue(args.formData, `${mediaKind}_image_url`)
    if (!publicUrl) return []

    return [
      {
        product_id: args.productId,
        media_kind: mediaKind,
        public_url: publicUrl,
        alt_text: `${args.title} ${mediaKind}`,
        sort_order: (index + 1) * 10,
        is_primary: true,
        metadata: {},
        created_by_auth_user_id: args.actorUserId,
        updated_by_auth_user_id: args.actorUserId,
        updated_at: new Date().toISOString(),
      },
    ]
  })
}

async function replaceProductMedia(args: {
  admin: ReturnType<typeof createAdminClient>
  productId: string
  mediaKinds: readonly string[]
  mediaRows: Array<Record<string, unknown>>
}) {
  const mediaDeleteResponse = await args.admin
    .from('store_product_media')
    .delete()
    .eq('product_id', args.productId)
    .in('media_kind', [...args.mediaKinds])

  if (mediaDeleteResponse.error) {
    throw new Error(mediaDeleteResponse.error.message)
  }

  if (args.mediaRows.length > 0) {
    const mediaInsertResponse = await args.admin.from('store_product_media').insert(args.mediaRows)
    if (mediaInsertResponse.error) {
      throw new Error(mediaInsertResponse.error.message)
    }
  }
}

async function requireEditableStoreProduct(args: {
  admin: ReturnType<typeof createAdminClient>
  productId: string
  expectedKind: string
  errorMessage: string
}) {
  const productResponse = await args.admin
    .from('store_products')
    .select('id, product_kind, title, boxes_per_case, metadata')
    .eq('id', args.productId)
    .single<StoreProductKindRow>()

  if (productResponse.error) {
    throw new Error(productResponse.error.message)
  }

  if (productResponse.data?.product_kind !== args.expectedKind) {
    redirectToStore({ error: args.errorMessage })
  }

  return productResponse.data
}

export async function createStoreCatalogItemAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const actorUserId = permissions.authUser!.id
  const itemKind = textValue(formData, 'item_kind')
  const admin = createAdminClient()

  try {
    const categoryId = await getCcicCategoryId(admin)
    const nowIso = new Date().toISOString()

    if (itemKind === 'card') {
      const title = 'Untitled Card'
      const createResponse = await admin.from('store_products').insert({
        category_id: categoryId,
        slug: datedSlug('untitled-card'),
        sku: null,
        product_kind: 'christmas_card_design',
        title,
        short_description: null,
        description: null,
        price_cents: 0,
        currency_code: 'CAD',
        status_code: 'draft',
        is_public: false,
        sort_order: 999,
        cards_per_box: null,
        envelopes_per_box: null,
        boxes_per_case: null,
        metadata: { styleFamily: 'custom', isSellable: false },
        created_by_auth_user_id: actorUserId,
        updated_by_auth_user_id: actorUserId,
        updated_at: nowIso,
      })
      if (createResponse.error) throw new Error(createResponse.error.message)
      revalidatePath('/super-admin/store')
      redirectToStore({ notice: 'New card created. Edit its fields in the Cards section.' })
    }

    if (itemKind === 'box') {
      const title = 'Untitled Box'
      const createResponse = await admin.from('store_products').insert({
        category_id: categoryId,
        slug: datedSlug('untitled-box'),
        sku: null,
        product_kind: 'christmas_card_box',
        title,
        short_description: null,
        description: null,
        price_cents: 0,
        currency_code: 'CAD',
        status_code: 'draft',
        is_public: false,
        sort_order: 999,
        cards_per_box: 12,
        envelopes_per_box: 12,
        boxes_per_case: null,
        metadata: { packCompositionLabel: '12 cards' },
        created_by_auth_user_id: actorUserId,
        updated_by_auth_user_id: actorUserId,
        updated_at: nowIso,
      })
      if (createResponse.error) throw new Error(createResponse.error.message)
      revalidatePath('/super-admin/store')
      redirectToStore({ notice: 'New box created. Add 12 cards in the Boxes section.' })
    }

    if (itemKind === 'case') {
      const title = 'Untitled Case'
      const createResponse = await admin.from('store_products').insert({
        category_id: categoryId,
        slug: datedSlug('untitled-case'),
        sku: null,
        product_kind: 'christmas_card_case',
        title,
        short_description: null,
        description: null,
        price_cents: 0,
        currency_code: 'CAD',
        status_code: 'draft',
        is_public: false,
        sort_order: 999,
        cards_per_box: null,
        envelopes_per_box: null,
        boxes_per_case: 1,
        metadata: {},
        created_by_auth_user_id: actorUserId,
        updated_by_auth_user_id: actorUserId,
        updated_at: nowIso,
      })
      if (createResponse.error) throw new Error(createResponse.error.message)
      revalidatePath('/super-admin/store')
      redirectToStore({ notice: 'New case created. Add boxes in the Cases section.' })
    }

    redirectToStore({ error: 'Choose whether to create a card, box, or case.' })
  } catch (error) {
    const message = errorMessageForStore(error, 'Could not create that catalog item right now.')
    redirectToStore({ error: message })
  }
}

export async function updateChristmasCardDesignProductAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const actorUserId = permissions.authUser!.id
  const productId = textValue(formData, 'product_id')

  if (!productId) {
    redirectToStore({ error: 'We could not tell which card to update.' })
  }

  const title = textValue(formData, 'title')
  if (!title) {
    redirectToStore({ error: 'Card title is required.' })
  }

  const admin = createAdminClient()

  try {
    const product = await requireEditableStoreProduct({
      admin,
      productId,
      expectedKind: 'christmas_card_design',
      errorMessage: 'Only internal card designs can be edited in this section.',
    })

    const styleFamily = textValue(formData, 'style_family')
    const updateResponse = await admin
      .from('store_products')
      .update({
        title,
        slug: slugify(textValue(formData, 'slug') ?? title),
        sku: textValue(formData, 'sku'),
        short_description: textValue(formData, 'short_description'),
        description: textValue(formData, 'description'),
        status_code: validatedStatusCode(textValue(formData, 'status_code')),
        is_public: false,
        sort_order: intValue(formData, 'sort_order') ?? 0,
        metadata: {
          ...((product.metadata ?? {}) as Record<string, unknown>),
          styleFamily,
          isSellable: false,
        },
        updated_by_auth_user_id: actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('product_kind', 'christmas_card_design')

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message)
    }

    await replaceProductMedia({
      admin,
      productId,
      mediaKinds: CARD_DESIGN_MEDIA_KINDS,
      mediaRows: mediaRowsForCardDesign({ productId, title, actorUserId, formData }),
    })

    revalidatePath('/super-admin/store')
    redirectToStore({ notice: `${title} was updated.` })
  } catch (error) {
    const message = errorMessageForStore(error, 'Could not update that card right now.')
    redirectToStore({ error: message })
  }
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
    await requireEditableStoreProduct({
      admin,
      productId,
      expectedKind: 'christmas_card_box',
      errorMessage: 'Only Christmas card boxes can be edited in this section.',
    })

    const updateResponse = await admin
      .from('store_products')
      .update({
        title,
        slug: slugify(textValue(formData, 'slug') ?? title),
        sku: textValue(formData, 'sku'),
        short_description: textValue(formData, 'short_description'),
        description: textValue(formData, 'description'),
        price_cents: priceCentsValue(formData, 'price_dollars', 'Card box price'),
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

    await replaceProductMedia({
      admin,
      productId,
      mediaKinds: CARD_BOX_MEDIA_KINDS,
      mediaRows: mediaRowsForCardBox({ productId, title, actorUserId, formData }),
    })

    revalidatePath('/super-admin/store')
    redirectToStore({ notice: `${title} was updated.` })
  } catch (error) {
    const message = errorMessageForStore(error, 'Could not update that card box right now.')
    redirectToStore({ error: message })
  }
}

export async function updateChristmasCardCaseProductAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const actorUserId = permissions.authUser!.id
  const productId = textValue(formData, 'product_id')

  if (!productId) {
    redirectToStore({ error: 'We could not tell which case to update.' })
  }

  const title = textValue(formData, 'title')
  if (!title) {
    redirectToStore({ error: 'Case title is required.' })
  }

  const admin = createAdminClient()

  try {
    await requireEditableStoreProduct({
      admin,
      productId,
      expectedKind: 'christmas_card_case',
      errorMessage: 'Only Christmas card cases can be edited in this section.',
    })

    const updateResponse = await admin
      .from('store_products')
      .update({
        title,
        slug: slugify(textValue(formData, 'slug') ?? title),
        sku: textValue(formData, 'sku'),
        short_description: textValue(formData, 'short_description'),
        description: textValue(formData, 'description'),
        price_cents: priceCentsValue(formData, 'price_dollars', 'Case price'),
        status_code: validatedStatusCode(textValue(formData, 'status_code')),
        is_public: checkboxValue(formData, 'is_public'),
        sort_order: intValue(formData, 'sort_order') ?? 0,
        updated_by_auth_user_id: actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('product_kind', 'christmas_card_case')

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message)
    }

    revalidatePath('/super-admin/store')
    redirectToStore({ notice: `${title} was updated.` })
  } catch (error) {
    const message = errorMessageForStore(error, 'Could not update that case right now.')
    redirectToStore({ error: message })
  }
}

export async function updateStoreAddOnProductAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const actorUserId = permissions.authUser!.id
  const productId = textValue(formData, 'product_id')

  if (!productId) {
    redirectToStore({ error: 'We could not tell which package to update.' })
  }

  const title = textValue(formData, 'title')
  if (!title) {
    redirectToStore({ error: 'Package title is required.' })
  }

  const admin = createAdminClient()

  try {
    await requireEditableStoreProduct({
      admin,
      productId,
      expectedKind: 'store_add_on',
      errorMessage: 'Only store packages can be edited in this section.',
    })

    const updateResponse = await admin
      .from('store_products')
      .update({
        title,
        slug: slugify(textValue(formData, 'slug') ?? title),
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
      .eq('product_kind', 'store_add_on')

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message)
    }

    revalidatePath('/super-admin/store')
    redirectToStore({ notice: `${title} was updated.` })
  } catch (error) {
    const message = errorMessageForStore(error, 'Could not update that package right now.')
    redirectToStore({ error: message })
  }
}

export async function updateChristmasCardCaseCompositionAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const actorUserId = permissions.authUser!.id
  const caseProductId = textValue(formData, 'case_product_id')

  if (!caseProductId) {
    redirectToStore({ error: 'We could not tell which case to update.', target: 'case-composition' })
  }

  if (!checkboxValue(formData, 'confirm_case_box_total')) {
    redirectToStore({ error: 'Confirm the case box total before saving the case composition.', target: 'case-composition' })
  }

  const admin = createAdminClient()

  try {
    const caseProduct = await requireEditableStoreProduct({
      admin,
      productId: caseProductId,
      expectedKind: 'christmas_card_case',
      errorMessage: 'Only Christmas card cases can be edited in this section.',
    })

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
      redirectToStore({ error: 'Add at least one Christmas card box before editing case composition.', target: 'case-composition' })
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
      redirectToStore({ error: 'Case composition must include at least one box.', target: 'case-composition' })
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
    redirectToStore({ notice: `${caseProduct.title ?? 'Case'} now includes ${totalBoxes} boxes.`, target: 'case-composition' })
  } catch (error) {
    const message = errorMessageForStore(error, 'Could not update that case composition right now.')
    redirectToStore({ error: message, target: 'case-composition' })
  }
}
