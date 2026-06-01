import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import AutoDismissingQueryMessage from '@/app/components/auto-dismissing-query-message'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateChristmasCardBoxProductAction } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type StoreCategoryRow = {
  id: string
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}

type StoreProductRow = {
  id: string
  category_id: string
  slug: string
  sku: string | null
  product_kind: string
  title: string
  short_description: string | null
  description: string | null
  price_cents: number
  currency_code: string
  status_code: string
  is_public: boolean
  sort_order: number
  cards_per_box: number | null
  envelopes_per_box: number | null
  boxes_per_case: number | null
}

type StoreProductComponentRow = {
  id: string
  parent_product_id: string
  component_product_id: string
  quantity: number
  component_role: string
  sort_order: number
}

type StoreProductMediaRow = {
  id: string
  product_id: string
  media_kind: string
  public_url: string | null
  is_primary: boolean
}

type CardBoxMediaValues = {
  front: string
  inside: string
  outside: string
}

function formatMoney(cents: number, currencyCode: string) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function productKindLabel(kind: string) {
  switch (kind) {
    case 'christmas_card_box':
      return 'Christmas card boxes'
    case 'christmas_card_set':
      return 'Christmas card sets'
    case 'christmas_card_case':
      return 'Christmas card cases'
    case 'store_add_on':
      return 'Add-ons'
    case 'physical_item':
      return 'Physical items'
    default:
      return kind
  }
}

function productUnitSummary(product: StoreProductRow) {
  if (product.product_kind === 'christmas_card_box') {
    return `${product.cards_per_box ?? 0} cards + ${product.envelopes_per_box ?? 0} envelopes per box`
  }

  if (product.product_kind === 'christmas_card_case') {
    return `${product.boxes_per_case ?? 0} boxes per case`
  }

  return 'Package'
}

function buildProductGroups(products: StoreProductRow[]) {
  const groups = new Map<string, StoreProductRow[]>()

  for (const product of products) {
    const bucket = groups.get(product.product_kind) ?? []
    bucket.push(product)
    groups.set(product.product_kind, bucket)
  }

  return [...groups.entries()].sort(([left], [right]) => productKindLabel(left).localeCompare(productKindLabel(right)))
}

function mediaValuesForProduct(mediaByProductId: Map<string, StoreProductMediaRow[]>, productId: string): CardBoxMediaValues {
  const rows = mediaByProductId.get(productId) ?? []
  return {
    front: rows.find((row) => row.media_kind === 'front')?.public_url ?? '',
    inside: rows.find((row) => row.media_kind === 'inside')?.public_url ?? '',
    outside: rows.find((row) => row.media_kind === 'outside')?.public_url ?? '',
  }
}

export default async function SuperAdminStorePage({ searchParams }: PageProps) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null

  const admin = createAdminClient()
  const [categoriesResponse, productsResponse, componentsResponse, mediaResponse] = await Promise.all([
    admin
      .from('store_categories')
      .select('id, slug, name, description, sort_order, is_active')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    admin
      .from('store_products')
      .select('id, category_id, slug, sku, product_kind, title, short_description, description, price_cents, currency_code, status_code, is_public, sort_order, cards_per_box, envelopes_per_box, boxes_per_case')
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true }),
    admin
      .from('store_product_components')
      .select('id, parent_product_id, component_product_id, quantity, component_role, sort_order')
      .order('sort_order', { ascending: true }),
    admin
      .from('store_product_media')
      .select('id, product_id, media_kind, public_url, is_primary'),
  ])

  if (categoriesResponse.error) throw new Error(`Could not load store categories: ${categoriesResponse.error.message}`)
  if (productsResponse.error) throw new Error(`Could not load store products: ${productsResponse.error.message}`)
  if (componentsResponse.error) throw new Error(`Could not load store product components: ${componentsResponse.error.message}`)
  if (mediaResponse.error) throw new Error(`Could not load store product media: ${mediaResponse.error.message}`)

  const categories = (categoriesResponse.data as StoreCategoryRow[] | null) ?? []
  const products = (productsResponse.data as StoreProductRow[] | null) ?? []
  const components = (componentsResponse.data as StoreProductComponentRow[] | null) ?? []
  const media = (mediaResponse.data as StoreProductMediaRow[] | null) ?? []

  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const productsById = new Map(products.map((product) => [product.id, product]))
  const componentsByParentId = new Map<string, StoreProductComponentRow[]>()
  const mediaByProductId = new Map<string, StoreProductMediaRow[]>()
  const mediaCountByProductId = new Map<string, number>()

  for (const component of components) {
    const bucket = componentsByParentId.get(component.parent_product_id) ?? []
    bucket.push(component)
    componentsByParentId.set(component.parent_product_id, bucket)
  }

  for (const mediaItem of media) {
    const bucket = mediaByProductId.get(mediaItem.product_id) ?? []
    bucket.push(mediaItem)
    mediaByProductId.set(mediaItem.product_id, bucket)
    mediaCountByProductId.set(mediaItem.product_id, (mediaCountByProductId.get(mediaItem.product_id) ?? 0) + 1)
  }

  const groupedProducts = buildProductGroups(products)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        {errorMessage ? (
          <AutoDismissingQueryMessage kind="error" message={errorMessage} className="qv-inline-message qv-inline-error" />
        ) : null}
        {noticeMessage ? (
          <AutoDismissingQueryMessage kind="notice" message={noticeMessage} className="qv-inline-message qv-inline-success" />
        ) : null}

        <section className="qv-card">
          <h1 className="qv-section-title">Store catalog</h1>
          <p className="qv-section-subtitle">
            Manage the seeded store catalog. Current focus is Celebrate Christ in Christmas boxed cards, cases, and packages.
          </p>
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Catalog summary</h2>
          <div className="qv-form-row qv-form-row-3" style={{ marginTop: 14 }}>
            <div className="qv-inline-message" style={{ display: 'grid', gap: 4 }}>
              <strong>{categories.length}</strong>
              <span>Categories</span>
            </div>
            <div className="qv-inline-message" style={{ display: 'grid', gap: 4 }}>
              <strong>{products.length}</strong>
              <span>Products</span>
            </div>
            <div className="qv-inline-message" style={{ display: 'grid', gap: 4 }}>
              <strong>{components.length}</strong>
              <span>Composition rows</span>
            </div>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Categories</h2>
          {categories.length === 0 ? (
            <div className="qv-empty" style={{ marginTop: 14 }}>
              <p className="qv-empty-title">No store categories yet</p>
              <p className="qv-empty-text">Run the CCiC seed after applying the store catalog migration.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {categories.map((category) => (
                <div key={category.id} className="qv-inline-message" style={{ display: 'grid', gap: 4 }}>
                  <strong>{category.name}</strong>
                  <span>{category.description ?? 'No description'}.</span>
                  <span>Slug: {category.slug} • {category.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Products</h2>
          <p className="qv-section-subtitle">
            Christmas card boxes can now be edited here. Cases and packages stay read-only for this seam.
          </p>

          {products.length === 0 ? (
            <div className="qv-empty" style={{ marginTop: 14 }}>
              <p className="qv-empty-title">No store products yet</p>
              <p className="qv-empty-text">Run the CCiC seed after applying the store catalog migration.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
              {groupedProducts.map(([kind, kindProducts]) => (
                <div key={kind} style={{ display: 'grid', gap: 10 }}>
                  <h3 className="qv-section-title" style={{ margin: 0 }}>{productKindLabel(kind)}</h3>
                  {kindProducts.map((product) => {
                    const category = categoriesById.get(product.category_id)
                    const productComponents = componentsByParentId.get(product.id) ?? []
                    const mediaCount = mediaCountByProductId.get(product.id) ?? 0
                    const mediaValues = mediaValuesForProduct(mediaByProductId, product.id)
                    const isCardBox = product.product_kind === 'christmas_card_box'

                    return (
                      <article key={product.id} className="qv-card" style={{ background: 'var(--bg-sunken)' }}>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                            <h4 className="qv-section-title" style={{ margin: 0 }}>{product.title}</h4>
                            <strong>{formatMoney(product.price_cents, product.currency_code)}</strong>
                          </div>
                          <p className="qv-section-subtitle" style={{ margin: 0 }}>
                            {product.short_description ?? 'No description'}
                          </p>
                          <p className="qv-section-subtitle" style={{ margin: 0 }}>
                            {category?.name ?? 'Uncategorized'} • SKU: {product.sku ?? 'None'} • {productUnitSummary(product)}
                          </p>
                          <p className="qv-section-subtitle" style={{ margin: 0 }}>
                            Status: {product.status_code} • Public: {product.is_public ? 'Yes' : 'No'} • Media: {mediaCount}
                          </p>
                        </div>

                        {isCardBox ? (
                          <form action={updateChristmasCardBoxProductAction} className="qv-form-grid" style={{ marginTop: 16 }}>
                            <input type="hidden" name="product_id" value={product.id} />

                            <div className="qv-form-row qv-form-row-2">
                              <label className="qv-field">
                                <span>Card box title</span>
                                <input name="title" type="text" required defaultValue={product.title} />
                              </label>
                              <label className="qv-field">
                                <span>SKU</span>
                                <input name="sku" type="text" defaultValue={product.sku ?? ''} />
                              </label>
                            </div>

                            <label className="qv-field">
                              <span>Short description</span>
                              <textarea name="short_description" rows={2} defaultValue={product.short_description ?? ''} />
                            </label>

                            <label className="qv-field">
                              <span>Inside message / longer description</span>
                              <textarea name="description" rows={3} defaultValue={product.description ?? ''} />
                            </label>

                            <div className="qv-form-row qv-form-row-3">
                              <label className="qv-field">
                                <span>Front image URL</span>
                                <input name="front_image_url" type="text" defaultValue={mediaValues.front} placeholder="/christmas-cards/example-front.jpg" />
                              </label>
                              <label className="qv-field">
                                <span>Inside image URL</span>
                                <input name="inside_image_url" type="text" defaultValue={mediaValues.inside} placeholder="/christmas-cards/example-inside.jpg" />
                              </label>
                              <label className="qv-field">
                                <span>Outside image URL</span>
                                <input name="outside_image_url" type="text" defaultValue={mediaValues.outside} placeholder="/christmas-cards/example-outside.jpg" />
                              </label>
                            </div>

                            <div className="qv-form-row qv-form-row-3">
                              <label className="qv-field">
                                <span>Status</span>
                                <select name="status_code" defaultValue={product.status_code}>
                                  <option value="draft">Draft</option>
                                  <option value="active">Active</option>
                                  <option value="archived">Archived</option>
                                </select>
                              </label>
                              <label className="qv-field">
                                <span>Sort order</span>
                                <input name="sort_order" type="number" defaultValue={product.sort_order} />
                              </label>
                              <label className="qv-field">
                                <span>Public</span>
                                <span className="qv-inline-message">
                                  <input name="is_public" type="checkbox" defaultChecked={product.is_public} /> Show in public catalog once wired
                                </span>
                              </label>
                            </div>

                            <div className="qv-form-actions">
                              <button type="submit" className="qv-button-secondary">Save card box</button>
                            </div>
                          </form>
                        ) : null}

                        {productComponents.length > 0 ? (
                          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                            <strong>Composition</strong>
                            {productComponents.map((component) => {
                              const child = productsById.get(component.component_product_id)
                              return (
                                <div key={component.id} className="qv-inline-message">
                                  <span>
                                    {component.quantity} x {child?.title ?? 'Unknown product'}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
