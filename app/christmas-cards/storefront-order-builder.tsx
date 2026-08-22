'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import BoxGalleryCard from './box-gallery-card'
import QuantityControl, { quantityFromMap, setQuantityValue } from './quantity-control'
import { useCcicCart } from './cart-context'
import {
  CHRISTMAS_CARD_ORDER_CONFIG,
  formatChristmasCardMoney,
  type ChristmasCardBox,
  type ChristmasCardCollection,
  type ChristmasCardCuratedCase,
} from '@/lib/christmas-cards/catalog'
import {
  CCIC_ORDER_DRAFT_STORAGE_KEY,
  calculateCcicOrder,
  parseCcicOrderDraftInput,
  type CcicFulfillmentMethod,
  type CcicOrderDraftInput,
} from '@/lib/christmas-cards/order'

type InventoryAvailability = Record<string, {
  isStoreEnabled: boolean
  stockOnHand: number | null
  committedBoxes: number
  reservedBoxes: number
  availableBoxes: number | null
}>

type Props = {
  cases: ChristmasCardCuratedCase[]
  boxes: ChristmasCardBox[]
  collections: ChristmasCardCollection[]
  inventoryAvailability: InventoryAvailability
  caseAvailability: Record<string, number>
}

type QuantityMap = Record<string, number>

function readStoredDraft() {
  const storedDraft = window.sessionStorage.getItem(CCIC_ORDER_DRAFT_STORAGE_KEY)
  if (!storedDraft) return null

  try {
    return parseCcicOrderDraftInput(JSON.parse(storedDraft))
  } catch {
    return null
  }
}

export default function StorefrontOrderBuilder({
  cases,
  boxes,
  collections,
  inventoryAvailability,
  caseAvailability,
}: Props) {
  const router = useRouter()
  const [caseQuantities, setCaseQuantities] = useState<QuantityMap>({})
  const [boxQuantities, setBoxQuantities] = useState<QuantityMap>({})
  const [fulfillmentMethod, setFulfillmentMethod] = useState<CcicFulfillmentMethod>('pickup')
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false)
  const { isOpen, closeCart, setSummary } = useCcicCart()

  const sortedBoxes = useMemo(() => [...boxes].sort((a, b) => a.sortOrder - b.sortOrder), [boxes])
  const sortedCollections = useMemo(() => [...collections].sort((a, b) => a.sortOrder - b.sortOrder), [collections])
  const caseEligibleBoxIds = useMemo(
    () => new Set(boxes.filter((box) => box.isCasePricingEligible).map((box) => box.id)),
    [boxes]
  )
  const draftInput = useMemo<CcicOrderDraftInput>(() => ({
    version: 1,
    caseQuantities,
    boxQuantities,
    fulfillmentMethod,
  }), [boxQuantities, caseQuantities, fulfillmentMethod])
  const calculatedOrder = useMemo(() => calculateCcicOrder(draftInput), [draftInput])
  const selectedClassicLines = calculatedOrder.lines.filter((line) => line.lineType === 'classic_case')
  const selectedIndividualLines = calculatedOrder.lines.filter((line) => line.lineType === 'individual_box')

  const { customCaseLines, looseIndividualLines, looseCaseEligibleBoxCount } = useMemo(() => {
    let boxesToAllocateToCases = calculatedOrder.customCaseCount * CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
    const customLines = [] as typeof selectedIndividualLines
    const looseLines = [] as typeof selectedIndividualLines
    let looseEligibleCount = 0

    for (const line of selectedIndividualLines) {
      const isCaseEligible = caseEligibleBoxIds.has(line.catalogId)
      const customQuantity = isCaseEligible
        ? Math.min(line.quantity, boxesToAllocateToCases)
        : 0
      const looseQuantity = line.quantity - customQuantity

      if (customQuantity > 0) {
        customLines.push({
          ...line,
          quantity: customQuantity,
          lineTotalCents: customQuantity * line.unitPriceCents,
        })
        boxesToAllocateToCases -= customQuantity
      }

      if (looseQuantity > 0) {
        looseLines.push({
          ...line,
          quantity: looseQuantity,
          lineTotalCents: looseQuantity * line.unitPriceCents,
        })
        if (isCaseEligible) looseEligibleCount += looseQuantity
      }
    }

    return {
      customCaseLines: customLines,
      looseIndividualLines: looseLines,
      looseCaseEligibleBoxCount: looseEligibleCount,
    }
  }, [calculatedOrder.customCaseCount, caseEligibleBoxIds, selectedIndividualLines])

  const progressPercent = Math.round(
    (looseCaseEligibleBoxCount / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase) * 100
  )

  function maxQuantityForBox(catalogId: string) {
    const availability = inventoryAvailability[catalogId]
    if (!availability) return 999
    if (!availability.isStoreEnabled) return 0
    return availability.availableBoxes === null ? 999 : availability.availableBoxes
  }

  function maxQuantityForCase(item: ChristmasCardCuratedCase) {
    const reservedAvailability = caseAvailability[item.id]
    if (reservedAvailability !== undefined) return reservedAvailability

    let maxCases = 999
    for (const component of item.components) {
      const availability = inventoryAvailability[component.boxId]
      if (!availability) continue
      if (!availability.isStoreEnabled) return 0
      if (availability.availableBoxes !== null) {
        maxCases = Math.min(maxCases, Math.floor(availability.availableBoxes / component.quantityBoxes))
      }
    }
    return maxCases
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedDraft = readStoredDraft()
      if (storedDraft) {
        setCaseQuantities(storedDraft.caseQuantities)
        setBoxQuantities(storedDraft.boxQuantities)
        setFulfillmentMethod(storedDraft.fulfillmentMethod)
      }
      setHasHydratedDraft(true)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!hasHydratedDraft) return

    if (calculatedOrder.hasOrder) {
      window.sessionStorage.setItem(CCIC_ORDER_DRAFT_STORAGE_KEY, JSON.stringify(draftInput))
    } else {
      window.sessionStorage.removeItem(CCIC_ORDER_DRAFT_STORAGE_KEY)
    }
  }, [calculatedOrder.hasOrder, draftInput, hasHydratedDraft])

  useEffect(() => {
    setSummary({
      totalSelectedBoxes: calculatedOrder.totalSelectedBoxes,
      estimatedTotalCents: calculatedOrder.totalCents,
      hasOrder: calculatedOrder.hasOrder,
      currentCaseProgress: calculatedOrder.currentCaseProgress,
      boxesPerCase: CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase,
    })
  }, [calculatedOrder, setSummary])

  useEffect(() => {
    if (!isOpen) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeCart()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [closeCart, isOpen])

  function reviewOrder() {
    if (!calculatedOrder.hasOrder) return
    window.sessionStorage.setItem(CCIC_ORDER_DRAFT_STORAGE_KEY, JSON.stringify(draftInput))
    closeCart()
    router.push('/ccic/review')
  }

  return (
    <>
      <section className="ccic-shop-layout ccic-shop-layout-full" aria-label="Christmas card order builder">
        <div className="ccic-shop-main">
          <section className="ccic-featured-case" id="curated-cases">
            {cases.map((item) => {
              const quantity = quantityFromMap(caseQuantities, item.id)
              const maxQuantity = maxQuantityForCase(item)
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
                      {formatChristmasCardMoney(item.priceCents)} per case{' '}
                      <span className="ccic-unit-price">
                        ({formatChristmasCardMoney(Math.round(item.priceCents / item.boxesPerCase))} per box)
                      </span>
                    </p>
                    <ul className="ccic-plain-list">
                      <li>{item.boxesPerCase} boxed greeting card sets</li>
                      <li>12 cards and 12 envelopes per box</li>
                      <li>{item.boxesPerCase * 12} cards total</li>
                      <li>Preselected assortment containing 2 boxes of each of our 16 designs.</li>
                      <li><strong>Best value!</strong></li>
                    </ul>
                    {maxQuantity > 0 ? (
                      <QuantityControl
                        label={`${item.title} cases`}
                        value={quantity}
                        max={maxQuantity}
                        onChange={(value) => setCaseQuantities((current) => setQuantityValue(current, item.id, value))}
                      />
                    ) : (
                      <span className="ccic-sold-out-pill" role="status">Sold out</span>
                    )}
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
                {formatChristmasCardMoney(CHRISTMAS_CARD_ORDER_CONFIG.customCasePriceCents)} total{' '}
                <span className="ccic-custom-unit-price">
                  ({formatChristmasCardMoney(Math.round(CHRISTMAS_CARD_ORDER_CONFIG.customCasePriceCents / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase))} per box)
                </span>.
              </p>
            </div>
          </section>

          <section className="ccic-ordering-steps" aria-labelledby="ordering-is-easy">
            <h2 id="ordering-is-easy">Ordering is easy</h2>
            <div>
              <article><strong>1. Make your selection</strong><p>Select a Classic Case or choose individual boxes.</p></article>
              <article><strong>2. Review your order</strong><p>Open the cart at any time to review quantities and pricing.</p></article>
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
                          maxQuantity={maxQuantityForBox(box.id)}
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
      </section>

      {isOpen ? (
        <div className="ccic-cart-layer">
          <button type="button" className="ccic-cart-backdrop" aria-label="Close order summary" onClick={closeCart} />
          <aside className="ccic-cart-drawer" id="ccic-cart-drawer" role="dialog" aria-modal="true" aria-label="Order summary">
            <div className="ccic-cart-drawer-header">
              <div>
                <p className="ccic-eyebrow">Your order</p>
                <h2>Order summary</h2>
              </div>
              <button type="button" className="ccic-cart-close" onClick={closeCart} aria-label="Close order summary" autoFocus>
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="ccic-cart-drawer-body">
              {!calculatedOrder.hasOrder ? (
                <p className="ccic-muted">Choose a Classic Case or individual boxes to begin.</p>
              ) : null}

              <div className="ccic-summary-scroll">
                {selectedClassicLines.length ? (
                  <div className="ccic-summary-section" style={{ borderTop: 0 }}>
                    <h3>Classic cases</h3>
                    {selectedClassicLines.map((line) => (
                      <div className="ccic-cart-item-row" key={line.catalogId}>
                        <div className="ccic-summary-line">
                          <span>{line.quantity} × {line.title}</span>
                          <strong>{formatChristmasCardMoney(line.lineTotalCents)}</strong>
                        </div>
                        <button
                          type="button"
                          className="ccic-cart-remove-item"
                          onClick={() => setCaseQuantities((current) => setQuantityValue(current, line.catalogId, 0))}
                          aria-label={`Remove ${line.title} from order`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {customCaseLines.length ? (
                  <div
                    className="ccic-summary-section"
                    style={!selectedClassicLines.length ? { borderTop: 0 } : undefined}
                  >
                    <h3>
                      {calculatedOrder.customCaseCount === 1
                        ? 'Custom case'
                        : `Custom cases ×${calculatedOrder.customCaseCount}`}
                    </h3>
                    {customCaseLines.map((line) => (
                      <div className="ccic-cart-item-row" key={`custom-${line.catalogId}`}>
                        <div className="ccic-summary-line">
                          <span>{line.quantity} × {line.title}</span>
                          <strong>{formatChristmasCardMoney(line.lineTotalCents)}</strong>
                        </div>
                        <button
                          type="button"
                          className="ccic-cart-remove-item"
                          onClick={() => setBoxQuantities((current) => setQuantityValue(current, line.catalogId, 0))}
                          aria-label={`Remove ${line.title} from order`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {looseIndividualLines.length ? (
                  <div
                    className="ccic-summary-section"
                    style={!selectedClassicLines.length && !customCaseLines.length ? { borderTop: 0 } : undefined}
                  >
                    <h3>Individual selections</h3>
                    {looseCaseEligibleBoxCount > 0 ? (
                      <div className="ccic-case-progress">
                        <div className="ccic-case-progress-copy">
                          <strong>{looseCaseEligibleBoxCount} of {CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase}</strong>
                          <span>boxes toward current custom case</span>
                        </div>
                        <div className="ccic-progress-track" aria-hidden="true">
                          <span style={{ width: `${progressPercent}%` }} />
                        </div>
                      </div>
                    ) : null}

                    {looseIndividualLines.map((line) => (
                      <div className="ccic-cart-item-row" key={`loose-${line.catalogId}`}>
                        <div className="ccic-summary-line">
                          <span>{line.quantity} × {line.title}</span>
                          <strong>{formatChristmasCardMoney(line.lineTotalCents)}</strong>
                        </div>
                        <button
                          type="button"
                          className="ccic-cart-remove-item"
                          onClick={() => setBoxQuantities((current) => setQuantityValue(current, line.catalogId, 0))}
                          aria-label={`Remove ${line.title} from order`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {calculatedOrder.customCaseCount ? (
                  <div className="ccic-summary-section ccic-custom-case-savings">
                    <div className="ccic-summary-line ccic-pricing-adjustment">
                      <span>
                        Custom Case pricing ({calculatedOrder.customCaseCount} complete case{calculatedOrder.customCaseCount === 1 ? '' : 's'})
                      </span>
                      <strong>−{formatChristmasCardMoney(calculatedOrder.customCaseDiscountCents)}</strong>
                    </div>

                    {calculatedOrder.customCaseDiscountCents ? (
                      <p className="ccic-good-news">
                        Custom Case pricing saved {formatChristmasCardMoney(calculatedOrder.customCaseDiscountCents)}.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {calculatedOrder.boxesUntilNextCase > 0 && calculatedOrder.remainingLooseBoxes >= 16 ? (
                  <p className="ccic-nudge">
                    <Image src="/chrism_star.png" alt="" width={24} height={24} />
                    Add {calculatedOrder.boxesUntilNextCase} more boxes and receive Custom Case pricing.
                  </p>
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
                    <strong>Calculated on next screen</strong>
                  </button>
                </div>
              </div>

              <div className="ccic-summary-total">
                <div className="ccic-summary-line ccic-total-line">
                  <span>Order total</span>
                  <strong>{formatChristmasCardMoney(calculatedOrder.totalCents)}</strong>
                </div>
              </div>

              <button type="button" className="ccic-primary-button" onClick={reviewOrder} disabled={!calculatedOrder.hasOrder}>
                Review order
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
