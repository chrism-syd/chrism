'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import BoxGalleryCard from './box-gallery-card'
import CardArt from './card-art'
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
type PackageTier = 'none' | 'promotion' | 'campaign'

function SavingsNudge({ boxesUntilNextCase, savingsCents }: { boxesUntilNextCase: number; savingsCents: number }) {
  return (
    <p className="ccic-nudge">
      <Image src="/chrism_star.png" alt="" width={24} height={24} className="ccic-nudge-star" />
      <span>Add {boxesUntilNextCase} more boxes to complete a case and save {formatChristmasCardMoney(savingsCents)}.</span>
    </p>
  )
}

function packageLabel(packageTier: PackageTier) {
  if (packageTier === 'promotion') return 'Promotion Package'
  if (packageTier === 'campaign') return 'Campaign Package'
  return 'Base order'
}

function packagePrice(packageTier: PackageTier) {
  if (packageTier === 'promotion') return CHRISTMAS_CARD_ORDER_CONFIG.promotionPackageCents
  if (packageTier === 'campaign') return CHRISTMAS_CARD_ORDER_CONFIG.campaignPackageCents
  return 0
}

export default function ChristmasCardsOrderBuilder({ cases, boxes, collections }: Props) {
  const [caseQuantities, setCaseQuantities] = useState<QuantityMap>({})
  const [individualBoxQuantities, setIndividualBoxQuantities] = useState<QuantityMap>({})
  const [selectedPackage, setSelectedPackage] = useState<PackageTier>('none')

  const sortedBoxes = useMemo(() => [...boxes].sort((left, right) => left.sortOrder - right.sortOrder), [boxes])
  const sortedCollections = useMemo(
    () => [...collections].sort((left, right) => left.sortOrder - right.sortOrder),
    [collections]
  )
  const boxesById = useMemo(() => new Map(boxes.map((box) => [box.id, box])), [boxes])
  const primaryCase = cases[0]

  const selectedCuratedCases = cases
    .map((item) => ({ item, quantity: quantityFromMap(caseQuantities, item.id) }))
    .filter((entry) => entry.quantity > 0)

  const eligibleIndividualBoxes = sortedBoxes.filter((box) => box.isCasePricingEligible)
  const eligibleIndividualBoxCount = eligibleIndividualBoxes.reduce(
    (total, box) => total + quantityFromMap(individualBoxQuantities, box.id),
    0
  )
  const individualBoxRegularTotalCents = eligibleIndividualBoxes.reduce(
    (total, box) => total + quantityFromMap(individualBoxQuantities, box.id) * box.priceCents,
    0
  )
  const customCaseCountFromSelection = primaryCase
    ? Math.floor(eligibleIndividualBoxCount / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase)
    : 0
  const remainingIndividualBoxes = primaryCase
    ? eligibleIndividualBoxCount % CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
    : eligibleIndividualBoxCount
  const individualBoxPriceCents = eligibleIndividualBoxes[0]?.priceCents ?? 0
  const individualCaseAdjustedTotalCents = primaryCase
    ? customCaseCountFromSelection * primaryCase.priceCents + remainingIndividualBoxes * individualBoxPriceCents
    : individualBoxRegularTotalCents
  const individualCaseSavingsCents = Math.max(0, individualBoxRegularTotalCents - individualCaseAdjustedTotalCents)
  const boxesUntilNextCase = remainingIndividualBoxes === 0
    ? 0
    : CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase - remainingIndividualBoxes
  const caseSavingsCents = primaryCase
    ? CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase * individualBoxPriceCents - primaryCase.priceCents
    : 0

  const curatedCaseTotalCents = selectedCuratedCases.reduce(
    (total, entry) => total + entry.quantity * entry.item.priceCents,
    0
  )
  const selectedPackageCents = packagePrice(selectedPackage)
  const subtotalCents = curatedCaseTotalCents + individualCaseAdjustedTotalCents + selectedPackageCents

  const totalSelectedCases = selectedCuratedCases.reduce((total, entry) => total + entry.quantity, 0) + customCaseCountFromSelection
  const totalSelectedBoxes =
    selectedCuratedCases.reduce((total, entry) => total + entry.quantity * entry.item.boxesPerCase, 0) + eligibleIndividualBoxCount

  const currentCaseProgress = eligibleIndividualBoxCount > 0 && remainingIndividualBoxes === 0
    ? CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
    : remainingIndividualBoxes
  const progressPercent = Math.min(100, Math.round((currentCaseProgress / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase) * 100))
  const hasOrder = subtotalCents > 0

  return (
    <>
      <section className="ccic-shop-layout" aria-label="Christmas card order builder">
        <div className="ccic-shop-main">
          <section className="ccic-featured-case" id="curated-cases">
            {cases.map((item) => {
              const value = quantityFromMap(caseQuantities, item.id)
              return (
                <article className="ccic-featured-case-card" key={item.id}>
                  <div className="ccic-case-art-grid" aria-label={`${item.title} artwork preview`}>
                    {item.components.slice(0, 8).map((component) => {
                      const box = boxesById.get(component.boxId)
                      return box ? (
                        <CardArt
                          key={component.boxId}
                          title={box.title}
                          imageUrl={box.frontImageUrl ?? box.outsideImageUrl ?? box.insideImageUrl}
                          size="small"
                          images={[
                            { label: 'Front', url: box.frontImageUrl ?? box.outsideImageUrl },
                            { label: 'Inside', url: box.insideImageUrl },
                            { label: 'Outside', url: box.outsideImageUrl },
                          ]}
                        />
                      ) : null
                    })}
                  </div>

                  <div className="ccic-featured-case-copy">
                    <p className="ccic-eyebrow">Most popular</p>
                    <h2>{item.title}</h2>
                    <p>{item.description}</p>
                    <p className="ccic-featured-case-price">{formatChristmasCardMoney(item.priceCents)} per case</p>
                    <ul className="ccic-plain-list">
                      <li>{item.boxesPerCase} boxed greeting card sets</li>
                      <li>12 cards and 12 envelopes per box</li>
                      <li>{item.boxesPerCase * 12} cards total</li>
                      <li>Exceptional value compared with individual boxes</li>
                    </ul>
                    <QuantityControl
                      label={`${item.title} cases`}
                      value={value}
                      onChange={(quantity) => setCaseQuantities((current) => setQuantityValue(current, item.id, quantity))}
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
              <p>Select any {CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase} eligible boxes and case pricing is applied automatically.</p>
            </div>
          </section>

          <section className="ccic-ordering-steps" aria-labelledby="ordering-is-easy">
            <h2 id="ordering-is-easy">Ordering is easy</h2>
            <div>
              <article>
                <strong>1. Make your selection</strong>
                <p>Select a curated case or choose individual boxes.</p>
              </article>
              <article>
                <strong>2. Review your order</strong>
                <p>Follow the summary as quantities and case pricing update.</p>
              </article>
              <article>
                <strong>3. Place your order</strong>
                <p>Confirm contact, delivery, and payment details before submitting.</p>
              </article>
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

                  {collectionBoxes.length > 0 ? (
                    <div className="ccic-gallery-grid">
                      {collectionBoxes.map((box) => {
                        const value = quantityFromMap(individualBoxQuantities, box.id)
                        return (
                          <BoxGalleryCard
                            key={`individual-${box.id}`}
                            box={box}
                            quantityLabel={`${box.title} individual boxes`}
                            quantity={value}
                            onQuantityChange={(quantity) => setIndividualBoxQuantities((current) => setQuantityValue(current, box.id, quantity))}
                          />
                        )
                      })}
                    </div>
                  ) : (
                    <div className="ccic-collection-empty">
                      <strong>Designs coming soon</strong>
                      <p>This collection row is ready for the final artwork and product details.</p>
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          <section className="ccic-packages" id="fundraising-packages">
            <div className="ccic-section-heading">
              <p className="ccic-eyebrow">Optional fundraising support</p>
              <h2>Choose a campaign package</h2>
              <p>Add parish branding, promotional materials, or both.</p>
            </div>

            <div className="ccic-package-grid" role="radiogroup" aria-label="Fundraising package">
              <label className={`ccic-package-card ${selectedPackage === 'promotion' ? 'is-selected' : ''}`}>
                <input type="radio" name="ccic-package" checked={selectedPackage === 'promotion'} onChange={() => setSelectedPackage('promotion')} />
                <span className="ccic-package-price">+{formatChristmasCardMoney(CHRISTMAS_CARD_ORDER_CONFIG.promotionPackageCents)}</span>
                <strong>Promotion Package</strong>
                <p>Personalize your cards with parish branding and a custom message.</p>
                <ul>
                  <li>Logo integration and custom message</li>
                  <li>Digital proof approval</li>
                  <li>Production setup and formatting</li>
                </ul>
              </label>

              <label className={`ccic-package-card ${selectedPackage === 'campaign' ? 'is-selected' : ''}`}>
                <input type="radio" name="ccic-package" checked={selectedPackage === 'campaign'} onChange={() => setSelectedPackage('campaign')} />
                <span className="ccic-package-price">+{formatChristmasCardMoney(CHRISTMAS_CARD_ORDER_CONFIG.campaignPackageCents)}</span>
                <strong>Campaign Package</strong>
                <p>A fuller parish campaign package for promoting card sales.</p>
                <ul>
                  <li>Everything in the Promotion Package</li>
                  <li>Five 18 x 24 promotional posters</li>
                  <li>One email, bulletin, or social graphic</li>
                </ul>
              </label>
            </div>

            {selectedPackage !== 'none' ? (
              <button type="button" className="ccic-remove-package-button" onClick={() => setSelectedPackage('none')}>
                Remove fundraising package
              </button>
            ) : null}
          </section>
        </div>

        <aside className="ccic-summary" id="order-summary" aria-label="Order summary">
          <div className="ccic-summary-card">
            <p className="ccic-eyebrow">Your order</p>
            <h2>Order summary</h2>

            <div className="ccic-case-progress" aria-label={`${currentCaseProgress} of ${CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase} boxes selected toward the current custom case`}>
              <div className="ccic-case-progress-copy">
                <strong>{currentCaseProgress} of {CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase}</strong>
                <span>boxes toward current case</span>
              </div>
              <div className="ccic-progress-track" aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {!hasOrder ? <p className="ccic-muted">Choose a curated case or individual boxes to begin.</p> : null}

            <div className="ccic-summary-scroll">
              {selectedCuratedCases.length > 0 ? (
                <div className="ccic-summary-section">
                  <h3>Curated cases</h3>
                  {selectedCuratedCases.map((entry) => (
                    <div className="ccic-summary-line" key={entry.item.id}>
                      <span>{entry.quantity} x {entry.item.title}</span>
                      <strong>{formatChristmasCardMoney(entry.quantity * entry.item.priceCents)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {customCaseCountFromSelection > 0 ? (
                <div className="ccic-summary-section">
                  <h3>Custom cases</h3>
                  <div className="ccic-summary-line">
                    <span>{customCaseCountFromSelection} x custom {CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase}-box case</span>
                    <strong>{primaryCase ? formatChristmasCardMoney(customCaseCountFromSelection * primaryCase.priceCents) : formatChristmasCardMoney(0)}</strong>
                  </div>
                </div>
              ) : null}

              {eligibleIndividualBoxCount > 0 ? (
                <div className="ccic-summary-section">
                  <h3>Individual selections</h3>
                  {sortedBoxes.map((box) => {
                    const quantity = quantityFromMap(individualBoxQuantities, box.id)
                    if (quantity <= 0) return null
                    return (
                      <div className="ccic-summary-line" key={`summary-${box.id}`}>
                        <span>{quantity} x {box.title}</span>
                        <strong>{formatChristmasCardMoney(quantity * box.priceCents)}</strong>
                      </div>
                    )
                  })}
                  {customCaseCountFromSelection > 0 && remainingIndividualBoxes > 0 ? (
                    <p className="ccic-muted">{remainingIndividualBoxes} extra boxes remain individually priced.</p>
                  ) : null}
                  {individualCaseSavingsCents > 0 ? (
                    <p className="ccic-good-news">Case pricing applied. You saved {formatChristmasCardMoney(individualCaseSavingsCents)}.</p>
                  ) : eligibleIndividualBoxCount >= Math.ceil(CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase / 2) && boxesUntilNextCase > 0 && caseSavingsCents > 0 ? (
                    <SavingsNudge boxesUntilNextCase={boxesUntilNextCase} savingsCents={caseSavingsCents} />
                  ) : null}
                </div>
              ) : null}

              {selectedPackage !== 'none' ? (
                <div className="ccic-summary-section">
                  <h3>Fundraising package</h3>
                  <div className="ccic-summary-line">
                    <span>{packageLabel(selectedPackage)}</span>
                    <strong>{formatChristmasCardMoney(selectedPackageCents)}</strong>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ccic-summary-total">
              <div className="ccic-summary-line">
                <span>Subtotal</span>
                <strong>{formatChristmasCardMoney(subtotalCents)}</strong>
              </div>
              <div className="ccic-summary-line">
                <span>Shipping</span>
                <strong>After review</strong>
              </div>
              <div className="ccic-summary-line ccic-total-line">
                <span>Estimated total</span>
                <strong>{formatChristmasCardMoney(subtotalCents)}</strong>
              </div>
            </div>

            <p className="ccic-summary-count">
              {totalSelectedCases > 0 || totalSelectedBoxes > 0
                ? `${totalSelectedCases} case${totalSelectedCases === 1 ? '' : 's'} / ${totalSelectedBoxes} box${totalSelectedBoxes === 1 ? '' : 'es'} selected`
                : CHRISTMAS_CARD_ORDER_CONFIG.shippingLabel}
            </p>

            <button type="button" className="ccic-primary-button" disabled>
              Review order coming next
            </button>
          </div>
        </aside>
      </section>

      {hasOrder ? (
        <a className="ccic-mobile-summary" href="#order-summary">
          <span>{totalSelectedBoxes} boxes</span>
          <strong>{formatChristmasCardMoney(subtotalCents)}</strong>
          <em>Review order</em>
        </a>
      ) : null}
    </>
  )
}
