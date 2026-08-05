import Link from 'next/link'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import {
  getCcicInventoryCatalogItems,
  getCcicStoreAvailabilityMap,
  syncCcicStoreInventoryCatalog,
} from '@/lib/christmas-cards/inventory'
import {
  adjustCcicInventoryStock,
  setCcicInventoryStock,
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
  'stock-update': 'The stock quantity could not be updated.',
  'store-toggle': 'The storefront availability could not be changed.',
}

const UPDATED_MESSAGES: Record<string, string> = {
  stock: 'The stock count was updated.',
  adjustment: 'The manual stock adjustment was applied.',
  enabled: 'The card is available in the store again.',
  disabled: 'The card is now marked sold out in the store.',
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
  const availability = await getCcicStoreAvailabilityMap()

  const trackedCount = items.filter((item) => availability[item.catalogId]?.stockOnHand !== null).length
  const manualOffCount = items.filter((item) => availability[item.catalogId]?.isStoreEnabled === false).length
  const soldOutCount = items.filter((item) => {
    const row = availability[item.catalogId]
    return row?.isStoreEnabled !== false && row?.availableBoxes === 0
  }).length

  return (
    <main className="ccic-admin-page ccic-store-control-page">
      <header className="ccic-admin-header">
        <div>
          <p>Celebrate Christ in Christmas</p>
          <h1>Store control</h1>
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
        <article><strong>{items.length}</strong><span>Coded card designs</span></article>
        <article><strong>{trackedCount}</strong><span>Inventory tracked</span></article>
        <article><strong>{soldOutCount}</strong><span>Automatically sold out</span></article>
        <article><strong>{manualOffCount}</strong><span>Manually turned off</span></article>
      </section>

      <section className="ccic-admin-panel ccic-store-control-intro">
        <div>
          <h2>Lightweight stock control</h2>
          <p>
            Set the number of boxes available at the start of tracking. Submitted, non-cancelled orders are counted as committed automatically.
            Use a positive or negative adjustment for sales and corrections made outside this store.
          </p>
        </div>
        <p>
          Leaving stock blank means the design is not quantity-limited. Turning a design off replaces its quantity selector with a Sold out label while keeping its card preview available.
        </p>
      </section>

      <section className="ccic-admin-panel">
        <div className="ccic-admin-panel-heading">
          <h2>Card inventory</h2>
          <span>Boxes, not individual cards</span>
        </div>

        <div className="ccic-admin-table-wrap">
          <table className="ccic-admin-table ccic-store-control-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Stock</th>
                <th>Committed</th>
                <th>Available</th>
                <th>Store status</th>
                <th>Set stock</th>
                <th>Adjust stock</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const row = availability[item.catalogId] ?? {
                  isStoreEnabled: true,
                  stockOnHand: null,
                  committedBoxes: 0,
                  availableBoxes: null,
                }
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
                    <td>{row.stockOnHand === null ? 'Not tracked' : row.stockOnHand}</td>
                    <td>{row.committedBoxes}</td>
                    <td>{row.availableBoxes === null ? 'Not limited' : row.availableBoxes}</td>
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
                      <form action={setCcicInventoryStock} className="ccic-store-inline-form">
                        <input type="hidden" name="catalog_id" value={item.catalogId} />
                        <input
                          type="number"
                          name="stock_on_hand"
                          min="0"
                          step="1"
                          defaultValue={row.stockOnHand ?? ''}
                          placeholder="Untracked"
                          aria-label={`Set stock for ${item.title}`}
                        />
                        <button type="submit">Save</button>
                      </form>
                    </td>
                    <td>
                      {row.stockOnHand === null ? (
                        <span className="ccic-store-muted">Set stock first</span>
                      ) : (
                        <form action={adjustCcicInventoryStock} className="ccic-store-inline-form">
                          <input type="hidden" name="catalog_id" value={item.catalogId} />
                          <input
                            type="number"
                            name="adjustment"
                            step="1"
                            placeholder="+ / −"
                            aria-label={`Adjust stock for ${item.title}`}
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
