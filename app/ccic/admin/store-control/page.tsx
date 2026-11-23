import Image from 'next/image'
import Link from 'next/link'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { CHRISTMAS_CARD_CURATED_CASES } from '@/lib/christmas-cards/catalog'
import {
  getCcicAdminStockBreakdown,
  getCcicCaseReserves,
  getCcicInventoryCatalogItems,
  getCcicMixedBoxAvailability,
  getCcicStoreAvailabilityMap,
  syncCcicStoreInventoryCatalog,
} from '@/lib/christmas-cards/inventory'
import {
  adjustCcicInventoryStock,
  setCcicClassicCaseReserve,
  setCcicPhysicalStockCount,
  toggleCcicInventoryStore,
} from './actions'
import '../../../christmas-cards/admin-orders.css'
import '../../../christmas-cards/store-control.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'CCIC Store Control | Chrism',
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

const ERROR_MESSAGES: Record<string, string> = {
  'invalid-product': 'That card could not be found in the coded catalogue.',
  'invalid-stock': 'Enter a whole stock quantity of zero or more, or leave it blank to stop tracking it.',
  'invalid-adjustment': 'Enter a non-zero whole number for the stock adjustment.',
  'set-stock-first': 'Set the stock count before using the adjustment control.',
  'negative-stock': 'That adjustment would make the stock count negative.',
  'stock-below-reserve': 'Stock cannot be reduced below boxes already committed to orders or currently protected for backed Classic Cases.',
  'stock-update': 'The stock quantity could not be updated.',
  'stock-changed-reload': 'Inventory changed since this page loaded. Reload and review the current quantities before saving.',
  'physical-below-reserve': 'The physical count cannot be less than boxes still needed for unshipped orders or backed Classic Cases.',
  'store-toggle': 'The storefront availability could not be changed.',
  'invalid-case': 'That Classic Case could not be found.',
  'invalid-reserve': 'Enter a whole number of reserve target cases, zero or more.',
  'reserve-below-committed': 'The reserve target cannot be lower than the number of Classic Cases already committed to active orders.',
  'reserve-update': 'The Classic Case reserve target could not be updated.',
}

const UPDATED_MESSAGES: Record<string, string> = {
  stock: 'The stock count was updated.',
  'physical-stock': 'The physical count was reconciled. Historical sales and school mixed-box allocations were preserved.',
  adjustment: 'The manual stock adjustment was applied.',
  enabled: 'The card is available in the store again.',
  disabled: 'The card is now marked sold out in the store.',
  reserve: 'The Classic Case reserve target was updated. Backed cases and held boxes were recalculated from current inventory.',
}

export default async function CcicStoreControlPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[]
    updated?: string | string[]
  }>
}) {
  await requireCcicOrderAdmin('/ccic/admin/store-control')
  await syncCcicStoreInventoryCatalog()

  const params = await searchParams
  const errorMessage = ERROR_MESSAGES[stringParam(params.error) || '']
  const updatedMessage = UPDATED_MESSAGES[stringParam(params.updated) || '']
  const items = getCcicInventoryCatalogItems()
  const [availability, caseReserves, stockBreakdown, mixedBoxes] = await Promise.all([
    getCcicStoreAvailabilityMap(),
    getCcicCaseReserves(),
    getCcicAdminStockBreakdown(),
    getCcicMixedBoxAvailability(),
  ])

  const trackedCount = items.filter((item) => availability[item.catalogId]?.stockOnHand !== null).length
  const untrackedCount = items.length - trackedCount
  const manualOffCount = items.filter((item) => availability[item.catalogId]?.isStoreEnabled === false).length
  const soldOutCount = items.filter((item) => {
    const row = availability[item.catalogId]
    return row?.isStoreEnabled !== false && row?.availableBoxes === 0
  }).length

  return (
    <main className="ccic-admin-page ccic-store-control-page">
      <header className="ccic-admin-header">
        <div className="ccic-admin-heading-brand">
          <Image src="/CCiC.png" alt="Celebrate Christ in Christmas" width={82} height={82} className="ccic-admin-logo" priority />
          <div>
            <p>Celebrate Christ in Christmas</p>
            <h1>Store control</h1>
          </div>
        </div>
        <div className="ccic-admin-header-actions">
          <Link href="/ccic/admin/orders">Orders</Link>
          <Link href="/ccic/admin/packing-list">Packing list</Link>
          <Link href="/ccic">View storefront</Link>
        </div>
      </header>

      {updatedMessage ? <p className="ccic-admin-notice">{updatedMessage}</p> : null}
      {errorMessage ? <p className="ccic-admin-error">{errorMessage}</p> : null}

      <section className="ccic-store-control-summary" aria-label="Inventory summary">
        <article><strong>{items.length}</strong><span>Products</span></article>
        <article>
          <strong>{trackedCount}</strong>
          <span>Inventory tracked</span>
          <small>{untrackedCount} inventory not being tracked</small>
        </article>
        <article><strong>{soldOutCount}</strong><span>Sold out</span></article>
        <article><strong>{manualOffCount}</strong><span>Manually turned off</span></article>
      </section>

      <section className="ccic-admin-panel ccic-case-reserve-panel">
        <div className="ccic-admin-panel-heading">
          <h2>Classic Case reserve</h2>
        </div>

        {CHRISTMAS_CARD_CURATED_CASES.map((item) => {
          const reserve = caseReserves.find((row) => row.caseCatalogId === item.id) ?? {
            caseCatalogId: item.id,
            reservedCases: 0,
            backedCases: 0,
            committedCases: 0,
            availableCases: 0,
          }
          const targetGap = Math.max(0, reserve.reservedCases - reserve.backedCases)

          return (
            <div className="ccic-case-reserve-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.sku}</span>
                {targetGap > 0 ? (
                  <small>
                    Target is {targetGap} case{targetGap === 1 ? '' : 's'} above current inventory capacity. Adding stock will automatically back more cases.
                  </small>
                ) : null}
              </div>
              <dl>
                <div><dt>Initial reserve</dt><dd>{reserve.reservedCases}</dd></div>
                <div><dt>Ordered</dt><dd>{reserve.committedCases}</dd></div>
                <div><dt>Remaining</dt><dd>{reserve.availableCases}</dd></div>
                <div><dt>Boxes reserved</dt><dd>{reserve.availableCases * item.boxesPerCase}</dd></div>
              </dl>
              <form action={setCcicClassicCaseReserve} className="ccic-case-reserve-form">
                <input type="hidden" name="case_catalog_id" value={item.id} />
                <label>
                  <span>Set reserve target</span>
                  <input type="number" name="reserved_cases" min={reserve.committedCases} step="1" defaultValue={reserve.reservedCases} required />
                </label>
                <button type="submit">Update target</button>
              </form>
            </div>
          )
        })}
      </section>

      <section className="ccic-admin-panel">
        <div className="ccic-admin-panel-heading">
          <h2>School mixed collections</h2>
          <span>Reserved for school orders and market sales</span>
        </div>
        <div className="ccic-admin-table-wrap">
          <table className="ccic-admin-table">
            <thead>
              <tr><th>Collection</th><th>Reserved boxes</th></tr>
            </thead>
            <tbody>
              {mixedBoxes.map((mixed) => (
                <tr key={mixed.mixedCatalogId}>
                  <td>
                    <strong>{mixed.title}</strong>
                    <span>{mixed.sku}</span>
                  </td>
                  <td>{mixed.committedMixedBoxes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ccic-admin-panel">
        <div className="ccic-admin-panel-heading">
          <h2>Product inventory</h2>
          <span>Card boxes and accessory sheets</span>
        </div>

        <div className="ccic-admin-table-wrap">
          <table className="ccic-admin-table ccic-store-control-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Remaining full boxes</th>
                <th>Held for Classic Cases</th>
                <th>Available</th>
                <th>Accounting details</th>
                <th>Store status</th>
                <th>Set counted boxes</th>
                <th>Adjust gross</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const row = availability[item.catalogId] ?? {
                  isStoreEnabled: true,
                  stockOnHand: null,
                  committedBoxes: 0,
                  reservedBoxes: 0,
                  availableBoxes: null,
                }
                const detail = stockBreakdown[item.catalogId] ?? {
                  dispatchedBoxes: 0,
                  outstandingBoxes: 0,
                  mixedSourceBoxes: 0,
                }
                const remainingFullBoxes = row.stockOnHand === null
                  ? null
                  : row.stockOnHand - detail.dispatchedBoxes - detail.mixedSourceBoxes
                const classicHeldBoxes = row.reservedBoxes - detail.mixedSourceBoxes
                const needsReview = classicHeldBoxes < 0 ||
                  row.committedBoxes !== detail.dispatchedBoxes + detail.outstandingBoxes ||
                  (remainingFullBoxes !== null && remainingFullBoxes < 0)
                const isManualOff = !row.isStoreEnabled
                const isAutomaticallySoldOut = row.isStoreEnabled && row.availableBoxes === 0
                const statusLabel = isManualOff
                  ? 'Manually off'
                  : isAutomaticallySoldOut
                    ? 'Sold out'
                    : 'Available'

                return (
                  <tr key={item.catalogId}>
                    <td>
                      <strong>{item.title}</strong>
                      <span>{item.sku}</span>
                    </td>
                    <td>{needsReview ? 'Review required' : remainingFullBoxes === null ? 'Not tracked' : remainingFullBoxes}</td>
                    <td>{needsReview ? 'Review' : classicHeldBoxes || '—'}</td>
                    <td>{row.availableBoxes === null ? 'Not limited' : row.availableBoxes}</td>
                    <td>
                      <span>Gross balance: {row.stockOnHand === null ? 'Untracked' : row.stockOnHand}</span>
                      <span>Shipped / delivered: {detail.dispatchedBoxes}</span>
                      <span>School mixed sources: {detail.mixedSourceBoxes}</span>
                    </td>
                    <td>
                      <span className={`ccic-store-status is-${isManualOff ? 'off' : isAutomaticallySoldOut ? 'sold-out' : 'available'}`}>
                        {statusLabel}
                      </span>
                      <form action={toggleCcicInventoryStore}>
                        <input type="hidden" name="catalog_id" value={item.catalogId} />
                        <input type="hidden" name="enabled" value={row.isStoreEnabled ? '0' : '1'} />
                        <button type="submit" className="ccic-store-link-button">
                          {row.isStoreEnabled ? 'Turn off' : 'Turn on'}
                        </button>
                      </form>
                    </td>
                    <td>
                      {needsReview ? (
                        <span className="ccic-store-muted">Reconcile source records first</span>
                      ) : (
                        <form action={setCcicPhysicalStockCount} className="ccic-store-inline-form">
                          <input type="hidden" name="catalog_id" value={item.catalogId} />
                          <input type="hidden" name="expected_gross" value={row.stockOnHand === null ? '' : String(row.stockOnHand)} />
                          <input type="hidden" name="expected_dispatched" value={String(detail.dispatchedBoxes)} />
                          <input type="hidden" name="expected_outstanding" value={String(detail.outstandingBoxes)} />
                          <input type="hidden" name="expected_mixed" value={String(detail.mixedSourceBoxes)} />
                          <input type="hidden" name="expected_reserved" value={String(row.reservedBoxes)} />
                          <input
                            type="number"
                            name="physical_stock"
                            min="0"
                            step="1"
                            defaultValue={remainingFullBoxes ?? ''}
                            placeholder="Count"
                            aria-label={`Count full boxes for ${item.title}`}
                            required
                          />
                          <button type="submit">Apply</button>
                        </form>
                      )}
                    </td>
                    <td>
                      {row.stockOnHand === null ? (
                        <span className="ccic-store-muted">Set count first</span>
                      ) : (
                        <form action={adjustCcicInventoryStock} className="ccic-store-inline-form">
                          <input type="hidden" name="catalog_id" value={item.catalogId} />
                          <input
                            type="number"
                            name="adjustment"
                            step="1"
                            placeholder="+ / −"
                            aria-label={`Adjust gross stock for ${item.title}`}
                            required
                          />
                          <button type="submit">Adjust</button>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
