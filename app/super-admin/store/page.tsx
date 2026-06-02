import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import AutoDismissingQueryMessage from '@/app/components/auto-dismissing-query-message'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import StoreProductsEditor, {
  type StoreProductComponentRow,
  type StoreProductMediaRow,
  type StoreProductRow,
} from './store-products-editor'
import './store-admin.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type StoreLoadResponse = {
  error: { message: string } | null
}

function storeLoadErrorMessage(label: string, response: StoreLoadResponse) {
  return response.error ? `Could not load ${label}: ${response.error.message}` : null
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
  const [productsResponse, componentsResponse, mediaResponse] = await Promise.all([
    admin
      .from('store_products')
      .select('id, category_id, slug, sku, product_kind, title, short_description, description, price_cents, currency_code, status_code, is_public, sort_order, cards_per_box, envelopes_per_box, boxes_per_case, boxes_left_count, metadata')
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

  const storeLoadError =
    storeLoadErrorMessage('store products', productsResponse)
    ?? storeLoadErrorMessage('store product components', componentsResponse)
    ?? storeLoadErrorMessage('store product media', mediaResponse)

  if (storeLoadError) {
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

          <section className="qv-card ccic-admin-hero-card">
            <h1 className="qv-section-title">Store catalog</h1>
            <p className="qv-section-subtitle">
              The store catalog could not be loaded right now. Refresh the page, or restart local Supabase if you just applied a migration.
            </p>
          </section>

          <section className="qv-inline-message qv-inline-error" style={{ marginTop: 18 }}>
            <p style={{ margin: 0 }}>{storeLoadError}</p>
          </section>
        </div>
      </main>
    )
  }

  const products = (productsResponse.data as StoreProductRow[] | null) ?? []
  const components = (componentsResponse.data as StoreProductComponentRow[] | null) ?? []
  const media = (mediaResponse.data as StoreProductMediaRow[] | null) ?? []
  const cases = products.filter((product) => product.product_kind === 'christmas_card_case')
  const cardBoxes = products.filter((product) => product.product_kind === 'christmas_card_box')
  const designs = products.filter((product) => product.product_kind === 'christmas_card_design')
  const addOns = products.filter((product) => product.product_kind === 'store_add_on')
  const editableProductCount = cases.length + cardBoxes.length + designs.length + addOns.length

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

        <section className="qv-hero-card ccic-admin-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">Celebrate Christ in Christmas</p>
              <div className="qv-directory-title-row">
                <h1 className="qv-directory-name">Store Catalog</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Manage CCiC cases, 12-card boxes, internal card designs, fundraising packages, and admin-only box counts.
              </p>
            </div>
          </div>

          <div className="qv-stats ccic-admin-stats">
            <div className="qv-stat-card">
              <div className="qv-stat-number">{cases.length}</div>
              <div className="qv-stat-label">Cases</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{cardBoxes.length}</div>
              <div className="qv-stat-label">Card boxes</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{designs.length}</div>
              <div className="qv-stat-label">Card designs</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{addOns.length}</div>
              <div className="qv-stat-label">Packages</div>
            </div>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Packages</h2>
          <p className="qv-section-subtitle">
            Cases contain card boxes. Card boxes contain internal card designs. Individual cards are not sold directly.
          </p>

          {editableProductCount === 0 ? (
            <div className="qv-empty" style={{ marginTop: 14 }}>
              <p className="qv-empty-title">No store packages yet</p>
              <p className="qv-empty-text">Run the CCiC seed after applying the store catalog migration.</p>
            </div>
          ) : (
            <StoreProductsEditor products={products} components={components} media={media} />
          )}
        </section>
      </div>
    </main>
  )
}
