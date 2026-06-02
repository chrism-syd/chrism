import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import SectionMenuBar from '@/app/components/section-menu-bar'
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

          <section className="qv-card">
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

        <section
          style={{
            display: 'grid',
            gap: 14,
            paddingTop: 28,
            marginBottom: 18,
          }}
        >
          <h1
            className="qv-directory-name"
            style={{
              margin: 0,
              fontSize: 'clamp(42px, 6.4vw, 68px)',
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            Store Catalog
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: '44ch',
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'var(--text-secondary)',
            }}
          >
            Build CCiC cards, boxes, and cases without exposing inventory or stock counts to purchasers.
          </p>
        </section>

        <section className="qv-hero-card">
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="qv-directory-hero">
              <div className="qv-directory-text">
                <p className="qv-eyebrow">Celebrate Christ in Christmas</p>
                <h2 className="qv-section-title" style={{ margin: 0 }}>
                  Catalog Builder
                </h2>
                <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                  Create internal card designs, assemble 12-card boxes, then build cases from those boxes. Individual cards are never sold directly.
                </p>
              </div>
            </div>

            <div className="qv-stats" style={{ marginTop: 0 }}>
              <div className="qv-stat-card">
                <div className="qv-stat-number">{designs.length}</div>
                <div className="qv-stat-label">Cards</div>
              </div>
              <div className="qv-stat-card">
                <div className="qv-stat-number">{cardBoxes.length}</div>
                <div className="qv-stat-label">Boxes</div>
              </div>
              <div className="qv-stat-card">
                <div className="qv-stat-number">{cases.length}</div>
                <div className="qv-stat-label">Cases</div>
              </div>
              <div className="qv-stat-card">
                <div className="qv-stat-number">{addOns.length}</div>
                <div className="qv-stat-label">Packages</div>
              </div>
            </div>
          </div>
        </section>

        <SectionMenuBar
          items={[
            { label: 'New Card', href: '#card-designs' },
            { label: 'New Box', href: '#card-boxes' },
            { label: 'New Case', href: '#cases' },
          ]}
          mobileLabel="Catalog actions"
        />

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Catalog items</h2>
          <p className="qv-section-subtitle">
            Cards are internal templates. Boxes are the sellable 12-packs. Cases are built from boxes.
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
