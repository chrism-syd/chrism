'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QuantityControl from './quantity-control'
import CardArt from './card-art'
import type { ChristmasCardBox, ChristmasCardMixedBox } from '@/lib/christmas-cards/catalog'
import type { CcicMixedBoxAvailability } from '@/lib/christmas-cards/inventory'
import { CCIC_SCHOOL_ORDER_DRAFT_STORAGE_KEY, calculateCcicSchoolOrder, parseCcicSchoolOrderDraft } from '@/lib/christmas-cards/school-order'

type Props = {
  mixedBoxes: ChristmasCardMixedBox[]
  boxes: ChristmasCardBox[]
  availability: CcicMixedBoxAvailability[]
  schoolSlug: string
  schoolCode: string
  schoolName: string
  orderingClosed: boolean
}

export default function SchoolMixedStorefront({ mixedBoxes, boxes, availability, schoolSlug, schoolCode, schoolName, orderingClosed }: Props) {
  const router = useRouter()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [hydrated, setHydrated] = useState(false)

  const draft = useMemo(() => ({ version: 1 as const, schoolSlug, schoolCode, quantities }), [quantities, schoolCode, schoolSlug])
  const calculated = useMemo(() => calculateCcicSchoolOrder(draft), [draft])
  const totalSelected = calculated.totalBoxes

  useEffect(() => {
    const stored = window.sessionStorage.getItem(CCIC_SCHOOL_ORDER_DRAFT_STORAGE_KEY)
    if (stored) {
      try {
        const parsed = parseCcicSchoolOrderDraft(JSON.parse(stored))
        if (parsed?.schoolSlug === schoolSlug && parsed.schoolCode === schoolCode) setQuantities(parsed.quantities)
      } catch {}
    }
    setHydrated(true)
  }, [schoolCode, schoolSlug])

  useEffect(() => {
    if (!hydrated) return
    if (calculated.hasOrder) window.sessionStorage.setItem(CCIC_SCHOOL_ORDER_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    else window.sessionStorage.removeItem(CCIC_SCHOOL_ORDER_DRAFT_STORAGE_KEY)
  }, [calculated.hasOrder, draft, hydrated])

  function reviewOrder() {
    if (orderingClosed || !calculated.hasOrder) return
    window.sessionStorage.setItem(CCIC_SCHOOL_ORDER_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    router.push(`/ccic/schools-2/${schoolSlug}/checkout`)
  }

  function maxQuantity(mixedCatalogId: string) {
    const row = availability.find((item) => item.mixedCatalogId === mixedCatalogId)
    return row?.additionalMixedBoxesAvailable ?? 999
  }

  return (
    <section className="ccic-school-mixed-storefront" aria-label="School mixed Christmas card boxes">
      <div className="ccic-school-mixed-intro">
        <div>
          <p className="ccic-eyebrow">Four simple choices</p>
          <h2>Choose your Christmas card collection</h2>
          <p>
            Each box includes 12 cards and envelopes, with 3 cards from each of the four designs in the collection.
            Every box sold contributes $4.50 to the {schoolName} fundraiser.
          </p>
        </div>
        <div className="ccic-school-mixed-price">
          <strong>$16.90</strong>
          <span>per box</span>
        </div>
      </div>

      {orderingClosed ? (
        <div className="ccic-school-ordering-closed-banner" role="status">
          <div>
            <p className="ccic-eyebrow">Fundraiser complete</p>
            <h3>School ordering is now closed.</h3>
            <p>Thank you for supporting {schoolName}. You can still browse the card collections below.</p>
          </div>
          <a href="/ccic">Shop CCIC Christmas Cards</a>
        </div>
      ) : null}

      <div className="ccic-school-mixed-grid" id="school-card-selections">
        {mixedBoxes.map((mixed, index) => {
          const collectionBoxes = boxes.filter((box) => box.collectionId === mixed.collectionId)
          const quantity = quantities[mixed.id] ?? 0
          const max = maxQuantity(mixed.id)

          return (
            <article className={`ccic-school-mixed-card ${quantity > 0 ? 'is-selected' : ''}`} key={mixed.id}>
              <div className="ccic-school-mixed-card-heading">
                <div>
                  <p className="ccic-school-mixed-kicker">Collection {index + 1}</p>
                  <h3>{mixed.title.replace(' Mixed Box', '')}</h3>
                  <p>3 of each design · 12 cards · 12 envelopes</p>
                </div>
                <span className="ccic-school-mixed-sku">{mixed.sku}</span>
              </div>

              <div className="ccic-school-mixed-designs" aria-label="Four card designs included in this mixed box">
                {collectionBoxes.map((box) => (
                  <figure className="ccic-school-mixed-design" key={box.id}>
                    <div className="ccic-school-mixed-design-image">
                      <CardArt
                        title={box.title}
                        imageUrl={box.frontImageUrl ?? box.outsideImageUrl ?? box.insideImageUrl}
                        images={[
                          { label: 'Cover', url: box.frontImageUrl ?? box.outsideImageUrl },
                          { label: 'Inside', url: box.insideImageUrl },
                          { label: 'Outside', url: box.outsideImageUrl },
                        ]}
                      />
                    </div>
                    <figcaption>{box.title}</figcaption>
                  </figure>
                ))}
              </div>

              <div className="ccic-school-mixed-card-footer">
                <div>
                  <strong className="ccic-school-mixed-card-price">$16.90</strong>
                  <span>$4.50 supports {schoolName}</span>
                </div>

                {orderingClosed ? (
                  <span className="ccic-school-ordering-closed-pill">Ordering closed</span>
                ) : max > 0 ? (
                  <div className="ccic-school-mixed-quantity-wrap">
                    <span>Quantity</span>
                    <QuantityControl
                      label={`${mixed.title} boxes`}
                      value={quantity}
                      max={max}
                      onChange={(next) => setQuantities((current) => ({ ...current, [mixed.id]: next }))}
                    />
                  </div>
                ) : (
                  <span className="ccic-sold-out-pill" role="status">Sold out</span>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {!orderingClosed && totalSelected > 0 ? (
        <div className="ccic-school-mixed-selection-note" role="status">
          <strong>{totalSelected} {totalSelected === 1 ? 'box' : 'boxes'} selected</strong>
          <span>{calculated.schoolContributionCents ? `${(calculated.schoolContributionCents / 100).toFixed(2)} supports ${schoolName}` : ''}</span>
          <button type="button" className="ccic-school-checkout-button" onClick={reviewOrder}>Review & checkout</button>
        </div>
      ) : null}
    </section>
  )
}
