'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import QuantityControl from './quantity-control'
import type { ChristmasCardBox, ChristmasCardMixedBox } from '@/lib/christmas-cards/catalog'
import type { CcicMixedBoxAvailability } from '@/lib/christmas-cards/inventory'

type Props = {
  mixedBoxes: ChristmasCardMixedBox[]
  boxes: ChristmasCardBox[]
  availability: CcicMixedBoxAvailability[]
}

export default function SchoolMixedStorefront({ mixedBoxes, boxes, availability }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const totalSelected = useMemo(
    () => Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
    [quantities]
  )

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
            Every box sold contributes $4.50 to the St. Francis Xavier fundraiser.
          </p>
        </div>
        <div className="ccic-school-mixed-price">
          <strong>$16.90</strong>
          <span>per box</span>
        </div>
      </div>

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
                      {box.frontImageUrl ?? box.outsideImageUrl ? (
                        <Image
                          src={(box.frontImageUrl ?? box.outsideImageUrl)!}
                          alt={`${box.title} cover`}
                          fill
                          sizes="(max-width: 700px) 38vw, 170px"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <figcaption>{box.title}</figcaption>
                  </figure>
                ))}
              </div>

              <div className="ccic-school-mixed-card-footer">
                <div>
                  <strong className="ccic-school-mixed-card-price">$16.90</strong>
                  <span>$4.50 supports St. Francis Xavier</span>
                </div>

                {max > 0 ? (
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

      {totalSelected > 0 ? (
        <div className="ccic-school-mixed-selection-note" role="status">
          <strong>{totalSelected} {totalSelected === 1 ? 'box' : 'boxes'} selected</strong>
          <span>Checkout will be connected next.</span>
        </div>
      ) : null}
    </section>
  )
}
