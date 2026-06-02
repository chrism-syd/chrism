import type { createAdminClient } from '@/lib/supabase/admin'
import {
  assertStoreCatalogSeedInvariants,
  type StoreCatalogSeed,
  type StoreCategorySeed,
  type StoreProductComponentSeed,
  type StoreProductMediaSeed,
  type StoreProductSeed,
} from './catalog-model'

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

type SupabaseErrorLike = {
  message: string
}

type SupabaseResponse<T> = {
  data: T | null
  error: SupabaseErrorLike | null
}

type StoreCategoryRow = {
  id: string
  slug: string
}

type StoreProductRow = {
  id: string
  slug: string
}

export type StoreCatalogSeedResult = {
  categoryCount: number
  productCount: number
  componentCount: number
  mediaCount: number
}

function requireData<T>(response: SupabaseResponse<T>, context: string): T {
  if (response.error) {
    throw new Error(`${context}: ${response.error.message}`)
  }
  if (!response.data) {
    throw new Error(`${context}: no data returned`)
  }
  return response.data
}

function categoryPayload(category: StoreCategorySeed, actorUserId: string | null) {
  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
    sort_order: category.sortOrder,
    is_active: category.isActive,
    metadata: category.metadata,
    created_by_auth_user_id: actorUserId,
    updated_by_auth_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  }
}

function productPayload(product: StoreProductSeed, categoryId: string, actorUserId: string | null) {
  return {
    category_id: categoryId,
    slug: product.slug,
    sku: product.sku,
    product_kind: product.productKind,
    title: product.title,
    short_description: product.shortDescription,
    description: product.description,
    price_cents: product.priceCents,
    currency_code: product.currencyCode,
    status_code: product.statusCode,
    is_public: product.isPublic,
    sort_order: product.sortOrder,
    cards_per_box: product.cardsPerBox,
    envelopes_per_box: product.envelopesPerBox,
    boxes_per_case: product.boxesPerCase,
    metadata: product.metadata,
    created_by_auth_user_id: actorUserId,
    updated_by_auth_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  }
}

function mediaPayload(media: StoreProductMediaSeed, productId: string, actorUserId: string | null) {
  return {
    product_id: productId,
    media_kind: media.mediaKind,
    public_url: media.publicUrl,
    alt_text: media.altText,
    sort_order: media.sortOrder,
    is_primary: media.isPrimary,
    metadata: media.metadata,
    created_by_auth_user_id: actorUserId,
    updated_by_auth_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  }
}

function componentPayload(component: StoreProductComponentSeed, parentProductId: string, componentProductId: string, actorUserId: string | null) {
  return {
    parent_product_id: parentProductId,
    component_product_id: componentProductId,
    quantity: component.quantity,
    component_role: component.componentRole,
    sort_order: component.sortOrder,
    metadata: component.metadata,
    created_by_auth_user_id: actorUserId,
    updated_by_auth_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  }
}

async function deleteStaleSeededCategoryProducts(args: {
  admin: SupabaseAdminClient
  categoryIds: string[]
  seededProductIds: string[]
}) {
  if (args.categoryIds.length === 0 || args.seededProductIds.length === 0) return

  const staleResponse = await args.admin
    .from('store_products')
    .select('id')
    .in('category_id', args.categoryIds)
    .not('id', 'in', `(${args.seededProductIds.join(',')})`)

  if (staleResponse.error) {
    throw new Error(`Could not find stale seeded category products: ${staleResponse.error.message}`)
  }

  const staleIds = ((staleResponse.data as Array<{ id: string }> | null) ?? []).map((row) => row.id)
  if (staleIds.length === 0) return

  const staleIdList = `(${staleIds.join(',')})`

  const staleParentComponentDeleteResponse = await args.admin
    .from('store_product_components')
    .delete()
    .in('parent_product_id', staleIds)

  if (staleParentComponentDeleteResponse.error) {
    throw new Error(`Could not clear stale product parent components: ${staleParentComponentDeleteResponse.error.message}`)
  }

  const staleChildComponentDeleteResponse = await args.admin
    .from('store_product_components')
    .delete()
    .filter('component_product_id', 'in', staleIdList)

  if (staleChildComponentDeleteResponse.error) {
    throw new Error(`Could not clear stale product child components: ${staleChildComponentDeleteResponse.error.message}`)
  }

  const staleProductDeleteResponse = await args.admin
    .from('store_products')
    .delete()
    .in('id', staleIds)

  if (staleProductDeleteResponse.error) {
    throw new Error(`Could not delete stale seeded category products: ${staleProductDeleteResponse.error.message}`)
  }
}

export async function upsertStoreCatalogSeed({
  admin,
  seed,
  actorUserId = null,
}: {
  admin: SupabaseAdminClient
  seed: StoreCatalogSeed
  actorUserId?: string | null
}): Promise<StoreCatalogSeedResult> {
  assertStoreCatalogSeedInvariants(seed)

  const categoryIdsByLegacyKey = new Map<string, string>()
  const productIdsByLegacyKey = new Map<string, string>()

  for (const category of seed.categories) {
    const row = requireData(
      await admin
        .from('store_categories')
        .upsert(categoryPayload(category, actorUserId), { onConflict: 'slug' })
        .select('id, slug')
        .single<StoreCategoryRow>(),
      `Could not upsert store category ${category.slug}`
    )

    categoryIdsByLegacyKey.set(category.legacyKey, row.id)
  }

  for (const product of seed.products) {
    const categoryId = categoryIdsByLegacyKey.get(product.categoryLegacyKey)
    if (!categoryId) {
      throw new Error(`Missing category id for product ${product.title}.`)
    }

    const row = requireData(
      await admin
        .from('store_products')
        .upsert(productPayload(product, categoryId, actorUserId), { onConflict: 'slug' })
        .select('id, slug')
        .single<StoreProductRow>(),
      `Could not upsert store product ${product.slug}`
    )

    productIdsByLegacyKey.set(product.legacyKey, row.id)
  }

  const seededProductIds = [...productIdsByLegacyKey.values()]
  if (seededProductIds.length > 0) {
    const mediaDeleteResponse = await admin
      .from('store_product_media')
      .delete()
      .in('product_id', seededProductIds)
    if (mediaDeleteResponse.error) {
      throw new Error(`Could not clear seeded product media: ${mediaDeleteResponse.error.message}`)
    }
  }

  const mediaRows = seed.media.map((media) => {
    const productId = productIdsByLegacyKey.get(media.productLegacyKey)
    if (!productId) {
      throw new Error(`Missing product id for media on ${media.productLegacyKey}.`)
    }
    return mediaPayload(media, productId, actorUserId)
  })

  if (mediaRows.length > 0) {
    const mediaInsertResponse = await admin.from('store_product_media').insert(mediaRows)
    if (mediaInsertResponse.error) {
      throw new Error(`Could not insert seeded product media: ${mediaInsertResponse.error.message}`)
    }
  }

  const parentProductIds = [
    ...new Set(
      seed.components.map((component) => {
        const productId = productIdsByLegacyKey.get(component.parentProductLegacyKey)
        if (!productId) {
          throw new Error(`Missing parent product id for ${component.parentProductLegacyKey}.`)
        }
        return productId
      })
    ),
  ]

  if (parentProductIds.length > 0) {
    const componentDeleteResponse = await admin
      .from('store_product_components')
      .delete()
      .in('parent_product_id', parentProductIds)
    if (componentDeleteResponse.error) {
      throw new Error(`Could not clear seeded product components: ${componentDeleteResponse.error.message}`)
    }
  }

  await deleteStaleSeededCategoryProducts({
    admin,
    categoryIds: [...categoryIdsByLegacyKey.values()],
    seededProductIds,
  })

  const componentRows = seed.components.map((component) => {
    const parentProductId = productIdsByLegacyKey.get(component.parentProductLegacyKey)
    const componentProductId = productIdsByLegacyKey.get(component.componentProductLegacyKey)
    if (!parentProductId || !componentProductId) {
      throw new Error(`Missing product id while preparing component for ${component.parentProductLegacyKey}.`)
    }
    return componentPayload(component, parentProductId, componentProductId, actorUserId)
  })

  if (componentRows.length > 0) {
    const componentInsertResponse = await admin.from('store_product_components').insert(componentRows)
    if (componentInsertResponse.error) {
      throw new Error(`Could not insert seeded product components: ${componentInsertResponse.error.message}`)
    }
  }

  return {
    categoryCount: seed.categories.length,
    productCount: seed.products.length,
    componentCount: seed.components.length,
    mediaCount: seed.media.length,
  }
}
