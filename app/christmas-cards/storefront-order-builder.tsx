'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import BoxGalleryCard from './box-gallery-card'
import QuantityControl, { quantityFromMap, setQuantityValue } from './quantity-control'
import {
  CHRISTMAS_CARD_ORDER_CONFIG,
  formatChristmasCardMoney,
  type ChristmasCardBox,
  type ChristmasCardCollection,
  type ChristmasCardCuratedCase,
} from '@/lib/christmas-cards/catalog'

type Props = {
  cases: ChristmasCardCuratedCase[]
  boxes: ChristmasCardBox[]
  collections: ChristmasCardCollection[]
}

type QuantityMap = Record<string, number>
type FulfillmentMethod = 'pickup' | 'shipping'

const SHIPPING_RATE_CENTS = 3600

export default function StorefrontOrderBuilder({ cases, boxes, collections }: Props) {
  const [caseQuantities, setCaseQuantities] = useState<QuantityMap>({})
  const [boxQuantities, setBoxQuantities] = useState<QuantityMap>({})
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('pickup')

  const sortedBoxes = useMemo(() => [...boxes].sort((a, b) => a.sortOrder - b.sortOrder), [boxes])
  const sortedCollections = useMemo(() => [...collections].sort((a, b) => a.sortOrder - b.sortOrder), [collections])

  const selectedClassicCases = cases
    .map((item) => ({ item, quantity: quantityFromMap(caseQuantities, item.id) }))
    .filter((entry) => entry.quantity > 0)

  const eligibleBoxes = sortedBoxes.filter((box) => box.isCasePricingEligible)
  const selectedLooseBoxCount = eligibleBoxes.reduce((sum, box) => sum + quantityFromMap(boxQuantities, box.id), 0)
  const selectedLooseBoxRetailCents = eligibleBoxes.reduce(
    (sum, box) => sum + quantityFromMap(boxQuantities, box.id) * box.priceCents,
    0
  )

  const customCaseCount = Math.floor(selectedLooseBoxCount / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase)
  const remainingLooseBoxes = selectedLooseBoxCount % CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
  const looseBoxPriceCents = eligibleBoxes[0]?.priceCents ?? 0
  const customSelectionCents =
    customCaseCount * CHRISTMAS_CARD_ORDER_CONFIG.customCasePriceCents + remainingLooseBoxes * looseBoxPriceCents
  const customCaseSavingsCents = Math.max(0, selectedLooseBoxRetailCents - customSelectionCents)
  const boxesUntilNextCase = remainingLooseBoxes === 0
    ? 0
    : CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase - remainingLooseBoxes

  const classicCaseTotalCents = selectedClassicCases.reduce(
    (sum, entry) => sum + entry.quantity * entry.item.priceCents,
    0
  )
  const subtotalCents = classicCaseTotalCents + customSelectionCents
  const hasOrder = subtotalCents > 0
  const shippingCents = hasOrder && fulfillmentMethod === 'shipping' ? SHIPPING_RATE_CENTS : 0
  const estimatedTotalCents = subtotalCents + shippingCents
  const totalSelectedBoxes = selectedClassicCases.reduce(
    (sum, entry) => sum + entry.quantity * entry.item.boxesPerCase,
    selectedLooseBoxCount
  )
  const totalSelectedCases = selectedClassicCases.reduce((sum, entry) => sum + entry.quantity, customCaseCount)
  const currentCaseProgress = selectedLooseBoxCount > 0 && remainingLooseBoxes === 0
    ? CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
    : remainingLooseBoxes
  const progressPercent = Math.round((currentCaseProgress / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase) * 100)

  return (
    <>
      <section className="ccic-shop-layout" aria-label="Christmas card order builder">
        <div className="ccic-shop-main">
          <section className="ccic-featured-case" id="curated-cases">
            {cases.map((item) => {
              const quantity = quantityFromMap(caseQuantities, item.id)
              return (
                <article className="ccic-featured-case-card" key={item.id}>
                  <div className="ccic-classic-case-image">
                    <Image
                      src="/CCIC_Classic32.jpg"
                      alt={`${item.title} assortment of 32 Christmas card boxes`}
                      fill
                      sizes="(max-width: 860px) 100vw, 62vw"
                    />
                  </div>

                  <div className="ccic-featured-case-copy">
                    <p className="ccic-eyebrow">Most popular</p>
                    <h2>{item.title}</h2>
                    <p>{item.description}</p>
                    <p className="ccic-featured-case-price">
                      {formatChristmasCardMoney(item.priceCents)} per case
                      <span>{formatChristmasCardMoney(Math.round(item.priceCents / item.boxesPerCase))} per box</span>
                    </p>
                    <ul className="ccic-plain-list">
                      <li>{item.boxesPerCase} boxed greeting card sets</li>
                      <li>12 cards and 12 envelopes per box</li>
                      <li>{item.boxesPerCase * 12} cards total</li>
                      <li>Preselected assortment at the best case price</li>
                    </ul>
                    <QuantityControl
                      label={`${item.title} cases`}
                      value={quantity}
                      onChange={(value) => setCaseQuantities((current) => setQuantityValue(current, item.id, value))}
                    />
                  </div>
                </article>
              )
            })}
          </section>

          <section className="ccic-custom-case-banner" aria-label="Custom case pricing">
            <div>
              <span>Custom case of</span>
              <strong>{CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase} boxes</strong>
            </div>
            <div>
              <strong>Make your own case.</strong>
              <p>
                Select any {CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase} boxes for{' '}
                {formatChristmasCardMoney(CHRISTMAS_CARD_ORDER_CONFIG.customCasePriceCents)} total, or{' '}
                {formatChristmasCardMoney(Math.round(CHRISTMAS_CARD_ORDER_CONFIG.customCasePriceCents / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase))} per box.
              </p>
            </div>
          </section>

          <section className="ccic-ordering-steps" aria-labelledby="ordering-is-easy">
            <h2 id="ordering-is-easy">Ordering is easy</h2>
            <div>
              <article><strong>1. Make your selection</strong><p>Select a Classic Case or choose individual boxes.</p></article>
              <article><strong>2. Review your order</strong><p>Watch the fixed summary update as you add boxes.</p></article>
              <article><strong>3. Place your order</strong><p>Choose pickup or shipping, then confirm your details.</p></article>
            </div>
          </section>

          <div className="ccic-collections" id="individual-boxes">
            {sortedCollections.map((collection) => {
              const collectionBoxes = sortedBoxes.filter((box) => box.collectionId === collection.id)
              return (
                <section className="ccic-collection" key={collection.id} aria-labelledby={`${collection.id}-title`}>
                  <div className="ccic-collection-heading">
                    <h2 id={`${collection.id}-title`}>{collection.title}</h2>
                    <p>{collection.description}</p>
                  </div>
                  {collectionBoxes.length ? (
                    <div className="ccic-gallery-grid">
                      {collectionBoxes.map((box) => (
                        <BoxGalleryCard
                          key={box.id}
                          box={box}
                          quantityLabel={`${box.title} boxes`}
                          quantity={quantityFromMap(boxQuantities, box.id)}
                          onQuantityChange={(value) => setBoxQuantities((current) => setQuantityValue(current, box.id, value))}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="ccic-collection-empty">
                      <strong>Designs coming soon</strong>
                      <p>This row is ready for the final collection artwork.</p>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>

        <aside className="ccic-summary" id="order-summary" aria-label="Order summary">
          <div className="ccic-summary-card">
            <p className="ccic-eyebrow">Your order</p>
            <h2>Order summary</h2>

            <div className="ccic-case-progress">
              <div className="ccic-case-progress-copy">
                <strong>{currentCaseProgress} of {CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase}</strong>
                <span>boxes toward current custom case</span>
              </div>
              <div className="ccic-progress-track" aria-hidden="true"><span style={{ width: `${progressPercent}%` }} /></div>
            </div>

            {!hasOrder ? <p className="ccic-muted">Choose a Classic Case or individual boxes to begin.</p> : null}

            <div className="ccic-summary-scroll">
              {selectedClassicCases.length ? (
                <div className="ccic-summary-section">
                  <h3>Classic cases</h3>
                  {selectedClassicCases.map((entry) => (
                    <div className="ccic-summary-line" key={entry.item.id}>
                      <span>{entry.quantity} x {entry.item.title}</span>
                      <strong>{formatChristmasCardMoney(entry.quantity * entry.item.priceCents)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {customCaseCount ? (
                <div className="ccic-summary-section">
                  <h3>Custom cases</h3>
                  <div className="ccic-summary-line">
                    <span>{customCaseCount} x custom 32-box case</span>
                    <strong>{formatChristmasCardMoney(customCaseCount * CHRISTMAS_CARD_ORDER_CONFIG.customCasePriceCents)}</strong>
                  </div>
                </div>
              ) : null}

              {selectedLooseBoxCount ? (
                <div className="ccic-summary-section">
                  <h3>Individual selections</h3>
                  {sortedBoxes.map((box) => {
                    const quantity = quantityFromMap(boxQuantities, box.id)
                    return quantity ? (
                      <div className="ccic-summary-line" key={box.id}>
                        <span>{quantity} x {box.title}</span>
                        <strong>{formatChristmasCardMoney(quantity * box.priceCents)}</strong>
                      </div>
                    ) : null
                  })}
                  {remainingLooseBoxes ? <p className="ccic-muted">{remainingLooseBoxes} boxes remain at $12 each.</p> : null}
                  {customCaseSavingsCents ? <p className="ccic-good-news">Custom case pricing saved {formatChristmasCardMoney(customCaseSavingsCents)}.</p> : null}
                  {!customCaseCount && boxesUntilNextCase > 0 && selectedLooseBoxCount >= 16 ? (
                    <p className="ccic-nudge"><Image src="/chrism_star.png" alt="" width={24} height={24} />Add {boxesUntilNextCase} more boxes to reach custom case pricing.</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="ccic-fulfillment-choice" aria-label="Fulfilment method">
              <span className="ccic-fulfillment-label">Fulfilment</span>
              <div className="ccic-fulfillment-toggle" role="group" aria-label="Choose pickup or shipping">
                <button
                  type="button"
                  className={fulfillmentMethod === 'pickup' ? 'is-selected' : ''}
                  aria-pressed={fulfillmentMethod === 'pickup'}
                  onClick={() => setFulfillmentMethod('pickup')}
                >
                  <span>Pickup</span>
                  <strong>$0</strong>
                </button>
                <button
                  type="button"
                  className={fulfillmentMethod === 'shipping' ? 'is-selected' : ''}
                  aria-pressed={fulfillmentMethod === 'shipping'}
                  onClick={() => setFulfillmentMethod('shipping')}
                >
                  <span>Shipping</span>
                  <strong>$36</strong>
                </button>
              </div>
            </div>

            <div className="ccic-summary-total">
              <div className="ccic-summary-line"><span>Subtotal</span><strong>{formatChristmasCardMoney(subtotalCents)}</strong></div>
              <div className="ccic-summary-line">
                <span>{fulfillmentMethod === 'shipping' ? 'Shipping' : 'Pickup'}</span>
                <strong>{formatChristmasCardMoney(shippingCents)}</strong>
              </div>
              <div className="ccic-summary-line ccic-total-line"><span>Estimated total</span><strong>{formatChristmasCardMoney(estimatedTotalCents)}</strong></div>
            </div>

            <p className="ccic-summary-count">
              {hasOrder
                ? `${totalSelectedCases} case${totalSelectedCases === 1 ? '' : 's'} / ${totalSelectedBoxes} boxes selected`
                : 'Pickup is free. Shipping is a flat $36 per order.'}
            </p>
            <button type="button" className="ccic-primary-button" disabled>Review order coming next</button>
          </div>
        </aside>
      </section>

      {hasOrder ? (
        <a className="ccic-mobile-summary" href="#order-summary"><span>{totalSelectedBoxes} boxes</span><strong>{formatChristmasCardMoney(estimatedTotalCents)}</strong><em>Review order</em></a>
      ) : null}
    </>
  )
}
