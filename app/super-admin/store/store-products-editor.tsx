import BoxCompositionForm from './box-composition-form'
import BoxStockForm from './box-stock-form'
import CaseCompositionForm from './case-composition-form'
import StoreThumbnail from './store-thumbnail'
import { updateChristmasCardBoxProductAction, updateStoreAddOnProductAction } from './actions'

export type StoreProductRow = {
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
  boxes_left_count: number | null
  metadata: Record<string, unknown> | null
}

export type StoreProductComponentRow = {
  id: string
  parent_product_id: string
  component_product_id: string
  quantity: number
  component_role: string
  sort_order: number
}

export type StoreProductMediaRow = {
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

type Props = {
  products: StoreProductRow[]
  components: StoreProductComponentRow[]
  media: StoreProductMediaRow[]
}

function formatMoney(cents: number, currencyCode: string) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatPriceInput(cents: number) {
  return (cents / 100).toFixed(2)
}

function productKindLabel(kind: string) {
  switch (kind) {
    case 'christmas_card_case':
      return 'Cases'
    case 'christmas_card_box':
      return 'Card Boxes'
    case 'christmas_card_design':
      return 'Card Designs'
    case 'store_add_on':
      return 'Packages'
    case 'christmas_card_set':
      return 'Christmas card sets'
    case 'physical_item':
      return 'Physical items'
    default:
      return kind
  }
}

function productKindSortOrder(kind: string) {
  switch (kind) {
    case 'christmas_card_case':
      return 10
    case 'christmas_card_box':
      return 20
    case 'christmas_card_design':
      return 30
    case 'store_add_on':
      return 40
    case 'physical_item':
      return 50
    case 'christmas_card_set':
      return 60
    default:
      return 100
  }
}

function productUnitSummary(product: StoreProductRow) {
  if (product.product_kind === 'christmas_card_box') {
    return `${product.cards_per_box ?? 0} cards + ${product.envelopes_per_box ?? 0} envelopes per box`
  }

  if (product.product_kind === 'christmas_card_case') {
    return `${product.boxes_per_case ?? 0} boxes per case`
  }

  if (product.product_kind === 'christmas_card_design') {
    return 'Internal card design, not sold directly'
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

  return [...groups.entries()].sort(([left], [right]) => productKindSortOrder(left) - productKindSortOrder(right))
}

function mediaValuesForProduct(mediaByProductId: Map<string, StoreProductMediaRow[]>, productId: string): CardBoxMediaValues {
  const rows = mediaByProductId.get(productId) ?? []
  return {
    front: rows.find((row) => row.media_kind === 'front')?.public_url ?? '',
    inside: rows.find((row) => row.media_kind === 'inside')?.public_url ?? '',
    outside: rows.find((row) => row.media_kind === 'outside')?.public_url ?? '',
  }
}

function quantityForComponent(components: StoreProductComponentRow[], componentProductId: string) {
  return components.find((component) => component.component_product_id === componentProductId)?.quantity ?? 0
}

function componentTotal(components: StoreProductComponentRow[]) {
  return components.reduce((total, component) => total + component.quantity, 0)
}

function metadataString(product: StoreProductRow, key: string) {
  const value = product.metadata?.[key]
  return typeof value === 'string' ? value : null
}

function productSummaryBlock(product: StoreProductRow, mediaCount: number) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <p className="qv-section-subtitle" style={{ margin: 0 }}>{product.short_description ?? 'No description'}</p>
      <p className="qv-section-subtitle" style={{ margin: 0 }}>SKU: {product.sku ?? 'None'} • {productUnitSummary(product)}</p>
      <p className="qv-section-subtitle" style={{ margin: 0 }}>Status: {product.status_code} • Public: {product.is_public ? 'Yes' : 'No'} • Media: {mediaCount}</p>
      {product.product_kind === 'christmas_card_box' ? (
        <p className="qv-section-subtitle" style={{ margin: 0 }}>Boxes left, admin only: {product.boxes_left_count ?? 'Not set'}</p>
      ) : null}
    </div>
  )
}

export default function StoreProductsEditor({ products, components, media }: Props) {
  const productsById = new Map(products.map((product) => [product.id, product]))
  const cardBoxes = products.filter((product) => product.product_kind === 'christmas_card_box')
  const designs = products.filter((product) => product.product_kind === 'christmas_card_design')
  const componentsByParentId = new Map<string, StoreProductComponentRow[]>()
  const mediaByProductId = new Map<string, StoreProductMediaRow[]>()
  const mediaCountByProductId = new Map<string, number>()
  const groupedProducts = buildProductGroups(products)

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

  return (
    <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
      {groupedProducts.map(([kind, kindProducts]) => (
        <div key={kind} style={{ display: 'grid', gap: 10 }}>
          <h3 className="qv-section-title" style={{ margin: 0 }}>{productKindLabel(kind)}</h3>

          {kind === 'christmas_card_design' ? (
            <div className="ccic-admin-design-catalog-grid">
              {kindProducts.map((design) => {
                const designMedia = mediaValuesForProduct(mediaByProductId, design.id)
                return (
                  <article key={design.id} className="ccic-admin-design-card">
                    <StoreThumbnail src={designMedia.front || null} alt={`${design.title} preview`} className="ccic-admin-design-thumbnail" />
                    <div style={{ display: 'grid', gap: 4 }}>
                      <strong>{design.title}</strong>
                      <span>{design.sku ?? 'No SKU'}</span>
                      <span>{metadataString(design, 'styleFamily') ?? 'No style family'}</span>
                      <span>{designMedia.front ? 'Image URL set' : 'No image URL'}</span>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}

          {kind === 'christmas_card_box' ? (
            <div className="ccic-admin-card-box-grid">
              {kindProducts.map((product) => {
                const productComponents = componentsByParentId.get(product.id) ?? []
                const mediaCount = mediaCountByProductId.get(product.id) ?? 0
                const mediaValues = mediaValuesForProduct(mediaByProductId, product.id)
                const currentComponentTotal = componentTotal(productComponents)

                return (
                  <article key={product.id} className="qv-card ccic-admin-product-card ccic-admin-card-box-card">
                    <div className="ccic-admin-card-box-heading">
                      <StoreThumbnail src={mediaValues.front || null} alt={`${product.title} preview`} className="ccic-admin-card-box-thumbnail" />
                      <div style={{ display: 'grid', gap: 6 }}>
                        <h4 className="qv-section-title" style={{ margin: 0 }}>{product.title}</h4>
                        <strong>{formatMoney(product.price_cents, product.currency_code)}</strong>
                        {productSummaryBlock(product, mediaCount)}
                      </div>
                    </div>

                    <form action={updateChristmasCardBoxProductAction} className="qv-form-grid ccic-admin-form ccic-admin-compact-card-box-form">
                      <input type="hidden" name="product_id" value={product.id} />
                      <label className="qv-field"><span>Card box title</span><input name="title" type="text" required defaultValue={product.title} /></label>
                      <div className="ccic-admin-compact-two">
                        <label className="qv-field"><span>SKU</span><input name="sku" type="text" defaultValue={product.sku ?? ''} /></label>
                        <label className="qv-field"><span>Price (CAD)</span><input name="price_dollars" type="number" min="0" step="0.01" required defaultValue={formatPriceInput(product.price_cents)} /></label>
                      </div>
                      <label className="qv-field"><span>Short description</span><textarea name="short_description" rows={2} defaultValue={product.short_description ?? ''} /></label>
                      <label className="qv-field"><span>Inside message / longer description</span><textarea name="description" rows={3} defaultValue={product.description ?? ''} /></label>
                      <label className="qv-field"><span>Front image URL</span><input name="front_image_url" type="text" defaultValue={mediaValues.front} placeholder="/christmas-cards/example-front.jpg" /></label>
                      <div className="ccic-admin-compact-two">
                        <label className="qv-field"><span>Inside image URL</span><input name="inside_image_url" type="text" defaultValue={mediaValues.inside} placeholder="/christmas-cards/example-inside.jpg" /></label>
                        <label className="qv-field"><span>Outside image URL</span><input name="outside_image_url" type="text" defaultValue={mediaValues.outside} placeholder="/christmas-cards/example-outside.jpg" /></label>
                      </div>
                      <div className="ccic-admin-compact-two">
                        <label className="qv-field"><span>Status</span><select name="status_code" defaultValue={product.status_code}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
                        <label className="qv-field"><span>Sort order</span><input name="sort_order" type="number" defaultValue={product.sort_order} /></label>
                      </div>
                      <label className="qv-field"><span>Public</span><span className="ccic-admin-confirmation"><input name="is_public" type="checkbox" defaultChecked={product.is_public} /> Show in public catalog once wired</span></label>
                      <div className="qv-form-actions"><button type="submit" className="qv-button-secondary">Save card box</button></div>
                    </form>

                    <BoxCompositionForm
                      boxProductId={product.id}
                      currentTotal={currentComponentTotal}
                      designs={designs.map((design) => {
                        const designMedia = mediaValuesForProduct(mediaByProductId, design.id)
                        return {
                          id: design.id,
                          title: design.title,
                          sku: design.sku,
                          styleFamily: metadataString(design, 'styleFamily'),
                          quantity: quantityForComponent(productComponents, design.id),
                          thumbnailUrl: designMedia.front || null,
                        }
                      })}
                    />

                    <BoxStockForm productId={product.id} initialBoxesLeft={product.boxes_left_count} />
                  </article>
                )
              })}
            </div>
          ) : null}

          {kind !== 'christmas_card_design' && kind !== 'christmas_card_box' ? kindProducts.map((product) => {
            const productComponents = componentsByParentId.get(product.id) ?? []
            const mediaCount = mediaCountByProductId.get(product.id) ?? 0
            const isAddOn = product.product_kind === 'store_add_on'
            const isCase = product.product_kind === 'christmas_card_case'
            const currentComponentTotal = componentTotal(productComponents)

            return (
              <article key={product.id} className="qv-card ccic-admin-product-card">
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                    <h4 className="qv-section-title" style={{ margin: 0 }}>{product.title}</h4>
                    <strong>{formatMoney(product.price_cents, product.currency_code)}</strong>
                  </div>
                  {productSummaryBlock(product, mediaCount)}
                </div>

                {isCase ? (
                  <CaseCompositionForm
                    caseProductId={product.id}
                    currentTotal={currentComponentTotal}
                    cardBoxes={cardBoxes.map((box) => {
                      const boxMedia = mediaValuesForProduct(mediaByProductId, box.id)
                      return {
                        id: box.id,
                        title: box.title,
                        sku: box.sku,
                        priceLabel: formatMoney(box.price_cents, box.currency_code),
                        quantity: quantityForComponent(productComponents, box.id),
                        thumbnailUrl: boxMedia.front || null,
                      }
                    })}
                  />
                ) : null}

                {isAddOn ? (
                  <form action={updateStoreAddOnProductAction} className="qv-form-grid ccic-admin-form" style={{ marginTop: 16 }}>
                    <input type="hidden" name="product_id" value={product.id} />
                    <div className="qv-form-row qv-form-row-3">
                      <label className="qv-field"><span>Package title</span><input name="title" type="text" required defaultValue={product.title} /></label>
                      <label className="qv-field"><span>SKU</span><input name="sku" type="text" defaultValue={product.sku ?? ''} /></label>
                      <label className="qv-field"><span>Price</span><input type="text" value={formatMoney(product.price_cents, product.currency_code)} readOnly aria-readonly="true" /></label>
                    </div>
                    <label className="qv-field"><span>Short description</span><textarea name="short_description" rows={2} defaultValue={product.short_description ?? ''} /></label>
                    <label className="qv-field"><span>Longer description</span><textarea name="description" rows={3} defaultValue={product.description ?? ''} /></label>
                    <div className="qv-form-row qv-form-row-3">
                      <label className="qv-field"><span>Status</span><select name="status_code" defaultValue={product.status_code}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
                      <label className="qv-field"><span>Sort order</span><input name="sort_order" type="number" defaultValue={product.sort_order} /></label>
                      <label className="qv-field"><span>Public</span><span className="ccic-admin-confirmation"><input name="is_public" type="checkbox" defaultChecked={product.is_public} /> Show in public catalog once wired</span></label>
                    </div>
                    <div className="qv-form-actions"><button type="submit" className="qv-button-secondary">Save package</button></div>
                  </form>
                ) : null}

                {productComponents.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                    <strong>Composition</strong>
                    {productComponents.map((component) => {
                      const child = productsById.get(component.component_product_id)
                      return <div key={component.id} className="qv-inline-message"><span>{component.quantity} x {child?.title ?? 'Unknown product'}</span></div>
                    })}
                  </div>
                ) : null}
              </article>
            )
          }) : null}
        </div>
      ))}
    </div>
  )
}
