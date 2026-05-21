'use client'

import { useMemo, useState } from 'react'
import CardArt from './card-art'
import {
  CHRISTMAS_CARD_ORDER_CONFIG,
  formatChristmasCardMoney,
  type ChristmasCardBox,
  type ChristmasCardCuratedCase,
} from '@/lib/christmas-cards/catalog'

type Props = {
  cases: ChristmasCardCuratedCase[]
  boxes: ChristmasCardBox[]
}

type QuantityMap = Record<string, number>

function clampQuantity(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(999, Math.floor(value)))
}

function quantityFromMap(map: QuantityMap, key: string) {
  return clampQuantity(map[key] ?? 0)
}

function setQuantityValue(map: QuantityMap, key: string, value: number) {
  return {
    ...map,
    [key]: clampQuantity(value),
  }
}

function QuantityControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="ccic-quantity" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label={`Remove one ${label}`}>
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button type="button" onClick={() => onChange(value + 1)} aria-label={`Add one ${label}`}>
        +
      </button>
    </div>
  )
}

function BoxGalleryCard({
  box,
  quantityLabel,
  quantity,
  onQuantityChange,
  showPrice = true,
}: {
  box: ChristmasCardBox
  quantityLabel: string
  quantity: number
  onQuantityChange: (quantity: number) => void
  showPrice?: boolean
}) {
  return (
    <article className="ccic-gallery-card">
      <CardArt title={box.title} imageUrl={box.frontImageUrl} />
      <div className="ccic-gallery-copy">
        <p className="ccic-product-kicker">{box.sku}</p>
        <h3>{box.title}</h3>
        <p>{box.cardsPerBox} cards + envelopes per box</p>
        {showPrice ? <strong>{formatChristmasCardMoney(box.priceCents)} per box</strong> : null}
        <details className="ccic-inside-preview">
          <summary>Inside wording</summary>
          <p>{box.insideMessage}</p>
        </details>
      </div>
      <QuantityControl label={quantityLabel} value={quantity} onChange={onQuantityChange} />
    </article>
  )
}

export default function ChristmasCardsOrderBuilder({ cases, boxes }: Props) {
  const [caseQuantities, setCaseQuantities] = useState<QuantityMap>({})
  const [customCaseBoxQuantities, setCustomCaseBoxQuantities] = useState<QuantityMap>({})
  const [individualBoxQuantities, setIndividualBoxQuantities] = useState<QuantityMap>({})
  const [customizationRequested, setCustomizationRequested] = useState(false)
  const [customLineText, setCustomLineText] = useState('')

  const sortedBoxes = useMemo(() => [...boxes].sort((left, right) => left.sortOrder - right.sortOrder), [boxes])
  const boxesById = useMemo(() => new Map(boxes.map((box) => [box.id, box])), [boxes])
  const primaryCase = cases[0]

  const selectedCuratedCases = cases
    .map((item) => ({ item, quantity: quantityFromMap(caseQuantities, item.id) }))
    .filter((entry) => entry.quantity > 0)

  const customCaseBoxCount = sortedBoxes.reduce(
    (total, box) => total + quantityFromMap(customCaseBoxQuantities, box.id),
    0
  )
  const customCaseComplete = customCaseBoxCount === CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
  const customCaseTooMany = customCaseBoxCount > CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
  const customCaseRemaining = CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase - customCaseBoxCount

  const eligibleIndividualBoxes = sortedBoxes.filter((box) => box.isCasePricingEligible)
  const eligibleIndividualBoxCount = eligibleIndividualBoxes.reduce(
    (total, box) => total + quantityFromMap(individualBoxQuantities, box.id),
    0
  )
  const individualBoxRegularTotalCents = eligibleIndividualBoxes.reduce(
    (total, box) => total + quantityFromMap(individualBoxQuantities, box.id) * box.priceCents,
    0
  )
  const fullCaseGroupsFromIndividualBoxes = primaryCase
    ? Math.floor(eligibleIndividualBoxCount / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase)
    : 0
  const remainingIndividualBoxes = primaryCase
    ? eligibleIndividualBoxCount % CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
    : eligibleIndividualBoxCount
  const individualBoxPriceCents = eligibleIndividualBoxes[0]?.priceCents ?? 0
  const individualCaseAdjustedTotalCents = primaryCase
    ? fullCaseGroupsFromIndividualBoxes * primaryCase.priceCents + remainingIndividualBoxes * individualBoxPriceCents
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
  const customCaseTotalCents = customCaseComplete && primaryCase ? primaryCase.priceCents : 0
  const customizationFeeCents = customizationRequested ? CHRISTMAS_CARD_ORDER_CONFIG.customLogoFeeCents : 0
  const subtotalCents = curatedCaseTotalCents + customCaseTotalCents + individualCaseAdjustedTotalCents + customizationFeeCents

  const totalSelectedCases = selectedCuratedCases.reduce((total, entry) => total + entry.quantity, 0) + (customCaseComplete ? 1 : 0) + fullCaseGroupsFromIndividualBoxes
  const totalSelectedBoxes =
    selectedCuratedCases.reduce((total, entry) => total + entry.quantity * entry.item.boxesPerCase, 0) +
    (customCaseComplete ? CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase : 0) +
    eligibleIndividualBoxCount

  const hasOrder = subtotalCents > 0 || customCaseBoxCount > 0 || customizationRequested

  return (
    <section className="ccic-builder" aria-label="Christmas card order builder">
      <div className="ccic-builder-main">
        <section className="ccic-panel" id="ready-made-cases">
          <div className="ccic-section-heading">
            <p className="ccic-eyebrow">Best value</p>
            <h2>Choose a ready-made case</h2>
            <p>Each case includes 35 boxes. Each box includes 12 folded cards and matching envelopes.</p>
          </div>

          <div className="ccic-card-list">
            {cases.map((item) => {
              const value = quantityFromMap(caseQuantities, item.id)
              const individualValue = item.boxesPerCase * individualBoxPriceCents
              const savings = Math.max(0, individualValue - item.priceCents)
              return (
                <article className="ccic-product-card" key={item.id}>
                  <div>
                    <p className="ccic-product-kicker">{item.sku}</p>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <p className="ccic-price-line">
                      {formatChristmasCardMoney(item.priceCents)} per case
                      {savings > 0 ? <span>Save {formatChristmasCardMoney(savings)} per case</span> : null}
                    </p>
                    <details className="ccic-case-details">
                      <summary>See what is included</summary>
                      <div className="ccic-case-gallery">
                        {item.components.map((component) => {
                          const box = boxesById.get(component.boxId)
                          return box ? (
                            <div className="ccic-case-gallery-item" key={component.boxId}>
                              <CardArt title={box.title} imageUrl={box.frontImageUrl} size="small" />
                              <span>{component.quantityBoxes} × {box.title}</span>
                            </div>
                          ) : null
                        })}
                      </div>
                    </details>
                  </div>
                  <QuantityControl
                    label={`${item.title} cases`}
                    value={value}
                    onChange={(quantity) => setCaseQuantities((current) => setQuantityValue(current, item.id, quantity))}
                  />
                </article>
              )
            })}
          </div>
        </section>

        <section className="ccic-panel" id="custom-case">
          <div className="ccic-section-heading">
            <p className="ccic-eyebrow">Build your own</p>
            <h2>Build your own case</h2>
            <p>Choose exactly 35 boxes total. The case price applies when the case is complete.</p>
          </div>

          <div className={`ccic-progress ${customCaseComplete ? 'is-complete' : ''} ${customCaseTooMany ? 'is-error' : ''}`}>
            <strong>{customCaseBoxCount} of {CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase} boxes selected</strong>
            <span>
              {customCaseComplete
                ? 'Your custom case is complete.'
                : customCaseTooMany
                  ? `Remove ${Math.abs(customCaseRemaining)} boxes to complete this case.`
                  : `Add ${customCaseRemaining} more boxes to complete this case.`}
            </span>
          </div>

          <div className="ccic-gallery-grid">
            {sortedBoxes.map((box) => {
              const value = quantityFromMap(customCaseBoxQuantities, box.id)
              return (
                <BoxGalleryCard
                  key={`custom-${box.id}`}
                  box={box}
                  showPrice={false}
                  quantityLabel={`${box.title} boxes in custom case`}
                  quantity={value}
                  onQuantityChange={(quantity) => setCustomCaseBoxQuantities((current) => setQuantityValue(current, box.id, quantity))}
                />
              )
            })}
          </div>
        </section>

        <section className="ccic-panel" id="individual-boxes">
          <div className="ccic-section-heading">
            <p className="ccic-eyebrow">Smaller orders</p>
            <h2>Add individual boxes</h2>
            <p>For smaller orders or extra boxes beyond a case. Individual boxes cost more per box than cases.</p>
          </div>

          <div className="ccic-gallery-grid">
            {sortedBoxes.map((box) => {
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
        </section>

        <section className="ccic-panel" id="custom-logo">
          <div className="ccic-section-heading">
            <p className="ccic-eyebrow">Optional</p>
            <h2>Add your local logo and message</h2>
            <p>
              For a flat {formatChristmasCardMoney(CHRISTMAS_CARD_ORDER_CONFIG.customLogoFeeCents)} fee, we can replace the standard logo with your council, parish, or organization logo and a short custom line of text.
            </p>
          </div>
          <label className="ccic-check-row">
            <input
              type="checkbox"
              checked={customizationRequested}
              onChange={(event) => setCustomizationRequested(event.target.checked)}
            />
            <span>Yes, I want custom logo/text replacement.</span>
          </label>
          {customizationRequested ? (
            <label className="ccic-field">
              <span>Custom line of text</span>
              <input
                value={customLineText}
                onChange={(event) => setCustomLineText(event.target.value)}
                placeholder="Example: Sponsored by St. Patrick's Council 7689"
              />
              <small>After submitting, reply to the confirmation email with your logo file.</small>
            </label>
          ) : null}
        </section>
      </div>

      <aside className="ccic-summary" aria-label="Order summary">
        <div className="ccic-summary-card">
          <p className="ccic-eyebrow">Your order</p>
          <h2>Order summary</h2>

          {!hasOrder ? <p className="ccic-muted">Choose cases or boxes to start your order.</p> : null}

          {selectedCuratedCases.length > 0 ? (
            <div className="ccic-summary-section">
              <h3>Ready-made cases</h3>
              {selectedCuratedCases.map((entry) => (
                <div className="ccic-summary-line" key={entry.item.id}>
                  <span>{entry.quantity} × {entry.item.title}</span>
                  <strong>{formatChristmasCardMoney(entry.quantity * entry.item.priceCents)}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {customCaseBoxCount > 0 ? (
            <div className="ccic-summary-section">
              <h3>Custom case</h3>
              <div className="ccic-summary-line">
                <span>{customCaseBoxCount} / {CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase} boxes selected</span>
                <strong>{customCaseComplete && primaryCase ? formatChristmasCardMoney(primaryCase.priceCents) : 'Not complete'}</strong>
              </div>
            </div>
          ) : null}

          {eligibleIndividualBoxCount > 0 ? (
            <div className="ccic-summary-section">
              <h3>Individual boxes</h3>
              <div className="ccic-summary-line">
                <span>{eligibleIndividualBoxCount} boxes selected</span>
                <strong>{formatChristmasCardMoney(individualCaseAdjustedTotalCents)}</strong>
              </div>
              {individualCaseSavingsCents > 0 ? (
                <p className="ccic-good-news">Case pricing applied. You saved {formatChristmasCardMoney(individualCaseSavingsCents)}.</p>
              ) : boxesUntilNextCase > 0 && caseSavingsCents > 0 ? (
                <p className="ccic-nudge">Add {boxesUntilNextCase} more boxes to make a case and save {formatChristmasCardMoney(caseSavingsCents)}.</p>
              ) : null}
              {fullCaseGroupsFromIndividualBoxes > 0 && remainingIndividualBoxes > 0 ? (
                <p className="ccic-muted">Case pricing applied to {fullCaseGroupsFromIndividualBoxes * CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase} boxes. {remainingIndividualBoxes} extra boxes are priced individually.</p>
              ) : null}
            </div>
          ) : null}

          {customizationRequested ? (
            <div className="ccic-summary-section">
              <h3>Customization</h3>
              <div className="ccic-summary-line">
                <span>Logo/text replacement</span>
                <strong>{formatChristmasCardMoney(customizationFeeCents)}</strong>
              </div>
              {customLineText.trim() ? <p className="ccic-muted">“{customLineText.trim()}”</p> : null}
            </div>
          ) : null}

          <div className="ccic-summary-total">
            <div className="ccic-summary-line">
              <span>Subtotal</span>
              <strong>{formatChristmasCardMoney(subtotalCents)}</strong>
            </div>
            <div className="ccic-summary-line">
              <span>Shipping</span>
              <strong>To be confirmed</strong>
            </div>
            <div className="ccic-summary-line ccic-total-line">
              <span>Estimated total</span>
              <strong>{formatChristmasCardMoney(subtotalCents)}</strong>
            </div>
          </div>

          <p className="ccic-muted">
            {totalSelectedCases > 0 || totalSelectedBoxes > 0
              ? `${totalSelectedCases} case${totalSelectedCases === 1 ? '' : 's'} / ${totalSelectedBoxes} box${totalSelectedBoxes === 1 ? '' : 'es'} selected.`
              : 'Shipping and payment will be confirmed by email.'}
          </p>

          <button type="button" className="ccic-primary-button" disabled>
            Review order coming next
          </button>
        </div>
      </aside>
    </section>
  )
}
