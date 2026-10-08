'use client'

import Image from 'next/image'
import { useState } from 'react'
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

  function maxQuantity(mixedCatalogId: string) {
    const row = availability.find((item) => item.mixedCatalogId === mixedCatalogId)
    return row?.additionalMixedBoxesAvailable ?? 999
  }

  return (
    <section className="ccic-shop-layout ccic-shop-layout-full" aria-label="School mixed Christmas card boxes">
      <div className="ccic-shop-main">
        <section className="ccic-ordering-steps" aria-labelledby="school-mixed-heading">
          <h2 id="school-mixed-heading">Choose from four mixed collections</h2>
          <div>
            <article>
              <strong>12 cards per box</strong>
              <p>Each box includes 3 cards from each of the four designs in the collection.</p>
            </article>
            <article>
              <strong>$16.90 per box</strong>
              <p>Each box includes 12 matching envelopes.</p>
            </article>
            <article>
              <strong>Support your school</strong>
              <p>$4.50 from every box sold goes to the St. Francis Xavier fundraiser.</p>
            </article>
          </div>
        </section>

        <div className="ccic-collections" id="school-card-selections">
          {mixedBoxes.map((mixed) => {
            const collectionBoxes = boxes.filter((box) => box.collectionId === mixed.collectionId)
            const quantity = quantities[mixed.id] ?? 0
            const max = maxQuantity(mixed.id)

            return (
              <section className="ccic-collection" key={mixed.id} aria-labelledby={`${mixed.id}-title`}>
                <div className="ccic-collection-heading">
                  <h2 id={`${mixed.id}-title`}>{mixed.title}</h2>
                  <p>Three of each design. Twelve cards and twelve envelopes.</p>
                </div>

                <article className={`ccic-school-mixed-box ${quantity > 0 ? 'is-selected' : ''}`}>
                  <div className="ccic-school-mixed-copy">
                    <p className="ccic-school-mixed-kicker">{mixed.title}</p>
                    <strong>3 of each design</strong>
                    <p className="ccic-product-kicker">{mixed.sku}</p>
                    <p>One box. All four designs. 12 cards + 12 envelopes.</p>
                  </div>

                  <div className="ccic-school-mixed-equation" aria-label="Three of each of the four card designs equals twelve cards">
                    <span className="ccic-school-mixed-count">3 ×</span>
                    {collectionBoxes.map((box, index) => (
                      <div className="ccic-school-mixed-cover-group" key={box.id}>
                        <div className="ccic-school-mixed-cover">
                          {box.frontImageUrl ?? box.outsideImageUrl ? (
                            <Image
                              src={(box.frontImageUrl ?? box.outsideImageUrl)!}
                              alt={`${box.title} cover`}
                              fill
                              sizes="90px"
                              unoptimized
                            />
                          ) : null}
                        </div>
                        {index < collectionBoxes.length - 1 ? <span className="ccic-school-mixed-plus">+</span> : null}
                      </div>
                    ))}
                    <span className="ccic-school-mixed-total">= 12 cards</span>
                  </div>

                  <div className="ccic-school-mixed-order">
                    <strong>$16.90</strong>
                    {max > 0 ? (
                      <QuantityControl
                        label={`${mixed.title} boxes`}
                        value={quantity}
                        max={max}
                        onChange={(next) => setQuantities((current) => ({ ...current, [mixed.id]: next }))}
                      />
                    ) : (
                      <span className="ccic-sold-out-pill" role="status">Sold out</span>
                    )}
                  </div>
                </article>
              </section>
            )
          })}
        </div>
      </div>
    </section>
  )
}
