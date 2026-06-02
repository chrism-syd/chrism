import BoxCompositionForm from './box-composition-form'
import BoxStockForm from './box-stock-form'
import CaseCompositionForm from './case-composition-form'
import StoreThumbnail from './store-thumbnail'
import {
  createStoreCatalogItemAction,
  updateChristmasCardBoxProductAction,
  updateChristmasCardCaseProductAction,
  updateChristmasCardDesignProductAction,
  updateStoreAddOnProductAction,
} from './actions'

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

function CreateButton({ itemKind, label }: { itemKind: 'card' | 'box' | 'case'; label: string }) {
  return (
    <form action={createStoreCatalogItemAction}>
      <input type="hidden" name="item_kind" value={itemKind} />
      <button type="submit" className="ccic-admin-add-button" aria-label={label}>+</button>
    </form>
  )
}

function SectionCard({
  id,
  title,
  subtitle,
  children,
  create,
}: {
  id: string
  title: string
  subtitle: string
  children: React.ReactNode
  create?: { itemKind: 'card' | 'box' | 'case'; label: string }
}) {
  return (
    <section id={id} className="qv-card ccic-admin-layout-card">
      <div className="qv-directory-section-head ccic-admin-section-head">
        <div>
          <h2 className="qv-section-title">{title}</h2>
          <p className="qv-section-subtitle">{subtitle}</p>
        </div>
        {create ? <CreateButton itemKind={create.itemKind} label={create.label} /> : null}
      </div>
      {children}
    </section>
  )
}

function ProductStatusFields({ product }: { product: StoreProductRow }) {
  return (
    <div className="ccic-admin-compact-two">
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
    </div>
  )
}

function CardDesignEditor({ product, mediaValues }: { product: StoreProductRow; mediaValues: CardBoxMediaValues }) {
  return (
    <article className="ccic-admin-design-card ccic-admin-design-edit-card">
      <StoreThumbnail src={mediaValues.front || null} alt={`${product.title} preview`} className="ccic-admin-design-thumbnail" />
      <form action={updateChristmasCardDesignProductAction} className="qv-form-grid ccic-admin-form ccic-admin-design-edit-form">
        <input type="hidden" name="product_id" value={product.id} />
        <label className="qv-field">
          <span>Card title</span>
          <input name="title" type="text" required defaultValue={product.title} />
        </label>
        <div className="ccic-admin-compact-two">
          <label className="qv-field">
            <span>Slug</span>
            <input name="slug" type="text" defaultValue={product.slug} />
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
          <span>Longer description</span>
          <textarea name="description" rows={2} defaultValue={product.description ?? ''} />
        </label>
        <label className="qv-field">
          <span>Image path</span>
          <input name="front_image_url" type="text" defaultValue={mediaValues.front} placeholder="/christmas-cards/example-front.jpg" />
        </label>
        <div className="ccic-admin-compact-two">
          <label className="qv-field">
            <span>Style family</span>
            <input name="style_family" type="text" defaultValue={metadataString(product, 'styleFamily') ?? ''} />
          </label>
          <label className="qv-field">
            <span>Sort order</span>
            <input name="sort_order" type="number" defaultValue={product.sort_order} />
          </label>
        </div>
        <label className="qv-field">
          <span>Status</span>
          <select name="status_code" defaultValue={product.status_code}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <div className="qv-form-actions"><button type="submit" className="qv-button-secondary">Save card</button></div>
      </form>
    </article>
  )
}

function CardBoxEditor({
  product,
  productComponents,
  mediaValues,
  designs,
  mediaByProductId,
}: {
  product: StoreProductRow
  productComponents: StoreProductComponentRow[]
  mediaValues: CardBoxMediaValues
  designs: StoreProductRow[]
  mediaByProductId: Map<string, StoreProductMediaRow[]>
}) {
  return (
    <article className="ccic-admin-box-block">
      <div className="ccic-admin-box-divider">{product.title}</div>
      <div className="qv-card ccic-admin-product-card ccic-admin-box-inner-card">
        <div className="ccic-admin-box-overview">
          <StoreThumbnail src={mediaValues.front || null} alt={`${product.title} preview`} className="ccic-admin-card-box-thumbnail" />
          <form action={updateChristmasCardBoxProductAction} className="qv-form-grid ccic-admin-form ccic-admin-box-details-form">
            <input type="hidden" name="product_id" value={product.id} />
            <div className="ccic-admin-compact-three">
              <label className="qv-field"><span>Box title</span><input name="title" type="text" required defaultValue={product.title} /></label>
              <label className="qv-field"><span>Slug</span><input name="slug" type="text" defaultValue={product.slug} /></label>
              <label className="qv-field"><span>SKU</span><input name="sku" type="text" defaultValue={product.sku ?? ''} /></label>
            </div>
            <div className="ccic-admin-compact-three">
              <label className="qv-field"><span>Price (CAD)</span><input name="price_dollars" type="number" min="0" step="0.01" required defaultValue={formatPriceInput(product.price_cents)} /></label>
              <label className="qv-field"><span>Cards per box</span><input type="text" value={`${product.cards_per_box ?? 12}`} readOnly aria-readonly="true" /></label>
              <label className="qv-field"><span>Envelopes per box</span><input type="text" value={`${product.envelopes_per_box ?? 12}`} readOnly aria-readonly="true" /></label>
            </div>
            <label className="qv-field"><span>Short description</span><textarea name="short_description" rows={2} defaultValue={product.short_description ?? ''} /></label>
            <label className="qv-field"><span>Inside message / longer description</span><textarea name="description" rows={2} defaultValue={product.description ?? ''} /></label>
            <div className="ccic-admin-compact-three">
              <label className="qv-field"><span>Front image URL</span><input name="front_image_url" type="text" defaultValue={mediaValues.front} placeholder="/christmas-cards/example-front.jpg" /></label>
              <label className="qv-field"><span>Inside image URL</span><input name="inside_image_url" type="text" defaultValue={mediaValues.inside} placeholder="/christmas-cards/example-inside.jpg" /></label>
              <label className="qv-field"><span>Outside image URL</span><input name="outside_image_url" type="text" defaultValue={mediaValues.outside} placeholder="/christmas-cards/example-outside.jpg" /></label>
            </div>
            <ProductStatusFields product={product} />
            <label className="qv-field"><span>Public</span><span className="ccic-admin-confirmation"><input name="is_public" type="checkbox" defaultChecked={product.is_public} /> Show in public catalog once wired</span></label>
            <div className="qv-form-actions"><button type="submit" className="qv-button-secondary">Save box details</button></div>
          </form>
        </div>

        <BoxCompositionForm
          boxProductId={product.id}
          currentTotal={componentTotal(productComponents)}
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
      </div>
    </article>
  )
}

function CaseEditor({
  product,
  productComponents,
  cardBoxes,
  mediaByProductId,
}: {
  product: StoreProductRow
  productComponents: StoreProductComponentRow[]
  cardBoxes: StoreProductRow[]
  mediaByProductId: Map<string, StoreProductMediaRow[]>
}) {
  return (
    <article className="qv-card ccic-admin-product-card ccic-admin-case-editor-card">
      <form action={updateChristmasCardCaseProductAction} className="qv-form-grid ccic-admin-form">
        <input type="hidden" name="product_id" value={product.id} />
        <div className="ccic-admin-compact-three">
          <label className="qv-field"><span>Case title</span><input name="title" type="text" required defaultValue={product.title} /></label>
          <label className="qv-field"><span>Slug</span><input name="slug" type="text" defaultValue={product.slug} /></label>
          <label className="qv-field"><span>SKU</span><input name="sku" type="text" defaultValue={product.sku ?? ''} /></label>
        </div>
        <div className="ccic-admin-compact-three">
          <label className="qv-field"><span>Price (CAD)</span><input name="price_dollars" type="number" min="0" step="0.01" required defaultValue={formatPriceInput(product.price_cents)} /></label>
          <label className="qv-field"><span>Boxes in case</span><input type="text" value={`${product.boxes_per_case ?? componentTotal(productComponents)}`} readOnly aria-readonly="true" /></label>
          <label className="qv-field"><span>Sort order</span><input name="sort_order" type="number" defaultValue={product.sort_order} /></label>
        </div>
        <label className="qv-field"><span>Short description</span><textarea name="short_description" rows={2} defaultValue={product.short_description ?? ''} /></label>
        <label className="qv-field"><span>Longer description</span><textarea name="description" rows={2} defaultValue={product.description ?? ''} /></label>
        <div className="ccic-admin-compact-two">
          <label className="qv-field">
            <span>Status</span>
            <select name="status_code" defaultValue={product.status_code}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="qv-field"><span>Public</span><span className="ccic-admin-confirmation"><input name="is_public" type="checkbox" defaultChecked={product.is_public} /> Show in public catalog once wired</span></label>
        </div>
        <div className="qv-form-actions"><button type="submit" className="qv-button-secondary">Save case details</button></div>
      </form>

      <CaseCompositionForm
        caseProductId={product.id}
        currentTotal={componentTotal(productComponents)}
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
    </article>
  )
}

function PackageEditor({ product }: { product: StoreProductRow }) {
  return (
    <article className="qv-card ccic-admin-product-card">
      <form action={updateStoreAddOnProductAction} className="qv-form-grid ccic-admin-form">
        <input type="hidden" name="product_id" value={product.id} />
        <div className="ccic-admin-compact-three">
          <label className="qv-field"><span>Package title</span><input name="title" type="text" required defaultValue={product.title} /></label>
          <label className="qv-field"><span>Slug</span><input name="slug" type="text" defaultValue={product.slug} /></label>
          <label className="qv-field"><span>SKU</span><input name="sku" type="text" defaultValue={product.sku ?? ''} /></label>
        </div>
        <label className="qv-field"><span>Price</span><input type="text" value={formatMoney(product.price_cents, product.currency_code)} readOnly aria-readonly="true" /></label>
        <label className="qv-field"><span>Short description</span><textarea name="short_description" rows={2} defaultValue={product.short_description ?? ''} /></label>
        <label className="qv-field"><span>Longer description</span><textarea name="description" rows={2} defaultValue={product.description ?? ''} /></label>
        <ProductStatusFields product={product} />
        <label className="qv-field"><span>Public</span><span className="ccic-admin-confirmation"><input name="is_public" type="checkbox" defaultChecked={product.is_public} /> Show in public catalog once wired</span></label>
        <div className="qv-form-actions"><button type="submit" className="qv-button-secondary">Save package</button></div>
      </form>
    </article>
  )
}

export default function StoreProductsEditor({ products, components, media }: Props) {
  const cardBoxes = products.filter((product) => product.product_kind === 'christmas_card_box')
  const designs = products.filter((product) => product.product_kind === 'christmas_card_design')
  const cases = products.filter((product) => product.product_kind === 'christmas_card_case')
  const addOns = products.filter((product) => product.product_kind === 'store_add_on')
  const componentsByParentId = new Map<string, StoreProductComponentRow[]>()
  const mediaByProductId = new Map<string, StoreProductMediaRow[]>()

  for (const component of components) {
    const bucket = componentsByParentId.get(component.parent_product_id) ?? []
    bucket.push(component)
    componentsByParentId.set(component.parent_product_id, bucket)
  }

  for (const mediaItem of media) {
    const bucket = mediaByProductId.get(mediaItem.product_id) ?? []
    bucket.push(mediaItem)
    mediaByProductId.set(mediaItem.product_id, bucket)
  }

  return (
    <div className="ccic-admin-layout-stack">
      <SectionCard
        id="cases"
        title="Cases"
        subtitle="Cases are built from boxes. Purchasers never see box stock counts."
        create={{ itemKind: 'case', label: 'New Case' }}
      >
        <div className="ccic-admin-section-body">
          {cases.map((product) => (
            <CaseEditor
              key={product.id}
              product={product}
              productComponents={componentsByParentId.get(product.id) ?? []}
              cardBoxes={cardBoxes}
              mediaByProductId={mediaByProductId}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        id="card-boxes"
        title="Boxes"
        subtitle="Boxes are the sellable 12-packs. Add 12 cards to each box."
        create={{ itemKind: 'box', label: 'New Box' }}
      >
        <div className="ccic-admin-box-list">
          {cardBoxes.map((product) => (
            <CardBoxEditor
              key={product.id}
              product={product}
              productComponents={componentsByParentId.get(product.id) ?? []}
              mediaValues={mediaValuesForProduct(mediaByProductId, product.id)}
              designs={designs}
              mediaByProductId={mediaByProductId}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        id="card-designs"
        title="Cards"
        subtitle="Cards are internal templates and are not sold directly."
        create={{ itemKind: 'card', label: 'New Card' }}
      >
        <div className="ccic-admin-card-design-grid">
          {designs.map((product) => (
            <CardDesignEditor
              key={product.id}
              product={product}
              mediaValues={mediaValuesForProduct(mediaByProductId, product.id)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        id="packages"
        title="Packages"
        subtitle="Fundraising packages and add-ons for the CCiC preorder workflow."
      >
        <div className="ccic-admin-section-body">
          {addOns.map((product) => <PackageEditor key={product.id} product={product} />)}
        </div>
      </SectionCard>
    </div>
  )
}
