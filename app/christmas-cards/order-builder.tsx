'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import BoxGalleryCard from './box-gallery-card'
import CardArt from './card-art'
import CustomLogoDetails from './custom-logo-details'
import CustomizationToggle from './customization-toggle'
import QuantityControl, { quantityFromMap, setQuantityValue } from './quantity-control'
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
type BooleanMap = Record<string, boolean>

function isCustomized(globalCustomization: boolean, overrides: BooleanMap, key: string) {
  return globalCustomization ? !overrides[key] : Boolean(overrides[key])
}

function setCustomizationValue(map: BooleanMap, key: string, checked: boolean, globalCustomization: boolean) {
  return {
    ...map,
    [key]: globalCustomization ? !checked : checked,
  }
}

function CustomStatus({ enabled }: { enabled: boolean }) {
  return <p className={enabled ? 'ccic-custom-status is-yes' : 'ccic-custom-status is-no'}>{enabled ? 'Custom logo/text' : 'No custom logo/text'}</p>
}

function SavingsNudge({ boxesUntilNextCase, savingsCents, savingsPercent }: { boxesUntilNextCase: number; savingsCents: number; savingsPercent: number }) {
  return (
    <p className="ccic-nudge">
      <Image src="/chrism_star.png" alt="" width={26} height={26} className="ccic-nudge-star" />
      <span>
        Add {boxesUntilNextCase} more boxes to make a case and save {formatChristmasCardMoney(savingsCents)}. That is a savings of {savingsPercent}%!
      </span>
    </p>
  )
}

export default function ChristmasCardsOrderBuilder({ cases, boxes }: Props) {
  const [caseQuantities, setCaseQuantities] = useState<QuantityMap>({})
  const [individualBoxQuantities, setIndividualBoxQuantities] = useState<QuantityMap>({})
  const [customizationRequested, setCustomizationRequested] = useState(false)
  const [customLineText, setCustomLineText] = useState('')
  const [caseCustomizationOverrides, setCaseCustomizationOverrides] = useState<BooleanMap>({})
  const [individualCustomizationOverrides, setIndividualCustomizationOverrides] = useState<BooleanMap>({})
  const [themeFilter, setThemeFilter] = useState('all')

  const sortedBoxes = useMemo(() => [...boxes].sort((left, right) => left.sortOrder - right.sortOrder), [boxes])
  const themeOptions = useMemo(
    () => Array.from(new Set(sortedBoxes.flatMap((box) => box.themeTags))).sort((left, right) => left.localeCompare(right)),
    [sortedBoxes]
  )
  const visibleIndividualBoxes = useMemo(
    () => themeFilter === 'all' ? sortedBoxes : sortedBoxes.filter((box) => box.themeTags.includes(themeFilter)),
    [sortedBoxes, themeFilter]
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
  const caseSavingsPercent = primaryCase && individualBoxPriceCents
    ? Math.round((caseSavingsCents / (CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase * individualBoxPriceCents)) * 100)
    : 0

  const anyIndividualBoxCustomized = sortedBoxes.some((box) =>
    quantityFromMap(individualBoxQuantities, box.id) > 0 && isCustomized(customizationRequested, individualCustomizationOverrides, box.id)
  )
  const anyCuratedCaseCustomized = selectedCuratedCases.some((entry) =>
    isCustomized(customizationRequested, caseCustomizationOverrides, entry.item.id)
  )
  const hasCustomizedSelection = anyIndividualBoxCustomized || anyCuratedCaseCustomized

  const curatedCaseTotalCents = selectedCuratedCases.reduce(
    (total, entry) => total + entry.quantity * entry.item.priceCents,
    0
  )
  const customizationFeeCents = hasCustomizedSelection ? CHRISTMAS_CARD_ORDER_CONFIG.customLogoFeeCents : 0
  const subtotalCents = curatedCaseTotalCents + individualCaseAdjustedTotalCents + customizationFeeCents

  const totalSelectedCases = selectedCuratedCases.reduce((total, entry) => total + entry.quantity, 0) + customCaseCountFromSelection
  const totalSelectedBoxes =
    selectedCuratedCases.reduce((total, entry) => total + entry.quantity * entry.item.boxesPerCase, 0) + eligibleIndividualBoxCount

  const hasOrder = subtotalCents > 0 || customizationRequested || hasCustomizedSelection

  return (
    <section className="ccic-builder" aria-label="Christmas card order builder">
      <div className="ccic-builder-main">
        <section className="ccic-panel" id="curated-cases">
          <div className="ccic-section-heading">
            <p className="ccic-eyebrow ccic-eyebrow-gold">Best value</p>
            <h2>Curated case</h2>
            <p>Each case includes 35 boxes. Each box includes 12 folded cards and matching envelopes.</p>
          </div>

          <div className="ccic-card-list">
            {cases.map((item) => {
              const value = quantityFromMap(caseQuantities, item.id)
              const individualValue = item.boxesPerCase * individualBoxPriceCents
              const savings = Math.max(0, individualValue - item.priceCents)
              const itemCustomized = isCustomized(customizationRequested, caseCustomizationOverrides, item.id)
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
                    <CustomizationToggle
                      checked={itemCustomized}
                      onChange={(checked) => setCaseCustomizationOverrides((current) => setCustomizationValue(current, item.id, checked, customizationRequested))}
                    />
                    <details className="ccic-case-details">
                      <summary>See what is included</summary>
                      <div className="ccic-case-gallery">
                        {item.components.map((component) => {
                          const box = boxesById.get(component.boxId)
                          return box ? (
                            <div className="ccic-case-gallery-item" key={component.boxId}>
                              <CardArt
                                title={box.title}
                                imageUrl={box.frontImageUrl ?? box.outsideImageUrl ?? box.insideImageUrl}
                                size="small"
                                images={[
                                  { label: 'Front', url: box.frontImageUrl ?? box.outsideImageUrl },
                                  { label: 'Inside', url: box.insideImageUrl },
                                  { label: 'Outside', url: box.outsideImageUrl },
                                ]}
                              />
                              <span>{component.quantityBoxes} x {box.title}</span>
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

        <section className="ccic-panel ccic-custom-callout" id="custom-logo">
          <div className="ccic-section-heading">
            <p className="ccic-eyebrow ccic-eyebrow-gold">New</p>
            <h2>Add your logo and message</h2>
            <p>
              For a flat {formatChristmasCardMoney(CHRISTMAS_CARD_ORDER_CONFIG.customLogoFeeCents)} fee, add your council, parish, or organization logo and a short custom line of text.
            </p>
            <CustomLogoDetails />
          </div>
          <label className="ccic-check-row">
            <input
              type="checkbox"
              checked={customizationRequested}
              onChange={(event) => setCustomizationRequested(event.target.checked)}
            />
            <span>Apply custom logo/text to selected cards.</span>
          </label>
          {customizationRequested ? (
            <label className="ccic-field">
              <span>Custom line of text</span>
              <input
                value={customLineText}
                onChange={(event) => setCustomLineText(event.target.value.slice(0, 150))}
                maxLength={150}
                placeholder="Example: Sponsored by St. Patrick's Council 7689"
              />
              <small>You can turn this off on any case or card box. After submitting, reply to the confirmation email with your logo file.</small>
              <small>{customLineText.length}/150 characters</small>
            </label>
          ) : null}
        </section>

        <section className="ccic-panel" id="individual-boxes">
          <div className="ccic-section-heading">
            <p className="ccic-eyebrow">Individual boxes</p>
            <h2>Custom selection</h2>
            <p>Choose any card boxes. When your selection reaches 35 boxes, case pricing is applied automatically.</p>
          </div>

          <label className="ccic-theme-filter">
            <span>View cards by theme</span>
            <select value={themeFilter} onChange={(event) => setThemeFilter(event.target.value)}>
              <option value="all">All cards</option>
              {themeOptions.map((theme) => <option key={theme} value={theme}>{theme}</option>)}
            </select>
          </label>

          <div className="ccic-gallery-grid">
            {visibleIndividualBoxes.map((box) => {
              const value = quantityFromMap(individualBoxQuantities, box.id)
              return (
                <BoxGalleryCard
                  key={`individual-${box.id}`}
                  box={box}
                  customized={isCustomized(customizationRequested, individualCustomizationOverrides, box.id)}
                  onCustomizedChange={(checked) => setIndividualCustomizationOverrides((current) => setCustomizationValue(current, box.id, checked, customizationRequested))}
                  quantityLabel={`${box.title} individual boxes`}
                  quantity={value}
                  onQuantityChange={(quantity) => setIndividualBoxQuantities((current) => setQuantityValue(current, box.id, quantity))}
                />
              )
            })}
          </div>
        </section>
      </div>

      <aside className="ccic-summary" aria-label="Order summary">
        <div className="ccic-summary-card">
          <p className="ccic-eyebrow">Your order</p>
          <h2>Order summary</h2>

          {!hasOrder ? <p className="ccic-muted">Choose cases or boxes to start your order.</p> : null}

          {selectedCuratedCases.length > 0 ? (
            <div className="ccic-summary-section">
              <h3>Curated cases</h3>
              {selectedCuratedCases.map((entry) => {
                const rowCustomized = isCustomized(customizationRequested, caseCustomizationOverrides, entry.item.id)
                return (
                  <div className="ccic-summary-row" key={entry.item.id}>
                    <div className="ccic-summary-line">
                      <span>{entry.quantity} x {entry.item.title}</span>
                      <strong>{formatChristmasCardMoney(entry.quantity * entry.item.priceCents)}</strong>
                    </div>
                    <CustomStatus enabled={rowCustomized} />
                  </div>
                )
              })}
            </div>
          ) : null}

          {customCaseCountFromSelection > 0 ? (
            <div className="ccic-summary-section">
              <h3>Custom case</h3>
              <div className="ccic-summary-line">
                <span>{customCaseCountFromSelection} x custom 35-box case</span>
                <strong>{primaryCase ? formatChristmasCardMoney(customCaseCountFromSelection * primaryCase.priceCents) : formatChristmasCardMoney(0)}</strong>
              </div>
              <p className="ccic-muted">Built from your custom selection.</p>
              <CustomStatus enabled={anyIndividualBoxCustomized} />
            </div>
          ) : null}

          {eligibleIndividualBoxCount > 0 ? (
            <div className="ccic-summary-section">
              <h3>Individual boxes</h3>
              {customCaseCountFromSelection > 0 ? <p className="ccic-muted">Selection details</p> : null}
              {sortedBoxes.map((box) => {
                const quantity = quantityFromMap(individualBoxQuantities, box.id)
                if (quantity <= 0) return null
                const rowCustomized = isCustomized(customizationRequested, individualCustomizationOverrides, box.id)
                return (
                  <div className="ccic-summary-row" key={`summary-${box.id}`}>
                    <div className="ccic-summary-line">
                      <span>{quantity} x {box.title}</span>
                      <strong>{formatChristmasCardMoney(quantity * box.priceCents)}</strong>
                    </div>
                    <CustomStatus enabled={rowCustomized} />
                  </div>
                )
              })}
              {customCaseCountFromSelection > 0 ? (
                <div className="ccic-summary-line">
                  <span>Remaining individual boxes</span>
                  <strong>{remainingIndividualBoxes}</strong>
                </div>
              ) : null}
              <div className="ccic-summary-line">
                <span>Adjusted custom selection total</span>
                <strong>{formatChristmasCardMoney(individualCaseAdjustedTotalCents)}</strong>
              </div>
              {individualCaseSavingsCents > 0 ? (
                <p className="ccic-good-news">Case pricing applied. You saved {formatChristmasCardMoney(individualCaseSavingsCents)}.</p>
              ) : eligibleIndividualBoxCount >= 18 && boxesUntilNextCase > 0 && caseSavingsCents > 0 ? (
                <SavingsNudge boxesUntilNextCase={boxesUntilNextCase} savingsCents={caseSavingsCents} savingsPercent={caseSavingsPercent} />
              ) : null}
              {customCaseCountFromSelection > 0 && remainingIndividualBoxes > 0 ? (
                <p className="ccic-muted">{remainingIndividualBoxes} extra boxes are priced individually.</p>
              ) : null}
            </div>
          ) : null}

          {customizationFeeCents > 0 ? (
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
