'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import SchoolBoxGalleryCard from './school-box-gallery-card'
import QuantityControl from './quantity-control'
import type { ChristmasCardBox, ChristmasCardCollection } from '@/lib/christmas-cards/catalog'

type InventoryAvailability = Record<string, {
  isStoreEnabled: boolean
  stockOnHand: number | null
  committedBoxes: number
  reservedBoxes: number
  availableBoxes: number | null
}>

type Props = {
  boxes: ChristmasCardBox[]
  collections: ChristmasCardCollection[]
  inventoryAvailability: InventoryAvailability
}

export default function SchoolStorefrontOrderBuilder({ boxes, collections, inventoryAvailability }: Props) {
  const sortedBoxes = useMemo(() => [...boxes].sort((a, b) => a.sortOrder - b.sortOrder), [boxes])
  const sortedCollections = useMemo(() => [...collections].sort((a, b) => a.sortOrder - b.sortOrder), [collections])
  const [mixedQuantities, setMixedQuantities] = useState<Record<string, number>>({})

  function maxQuantityForBox(catalogId: string) {
    const availability = inventoryAvailability[catalogId]
    if (!availability) return 999
    if (!availability.isStoreEnabled) return 0
    return availability.availableBoxes === null ? 999 : availability.availableBoxes
  }

  return (
    <section className="ccic-shop-layout ccic-shop-layout-full" aria-label="School Christmas card catalogue">
      <div className="ccic-shop-main">
        <div className="ccic-collections" id="school-card-selections">
          {sortedCollections.map((collection, collectionIndex) => {
            const collectionBoxes = sortedBoxes.filter((box) => box.collectionId === collection.id)
            const mixedQuantity = mixedQuantities[collection.id] ?? 0
            const mixedSku = `CCIC-26-${String(collectionIndex + 1).padStart(2, '0')}-MIX`

            return (
              <section className="ccic-collection" key={collection.id} aria-labelledby={`school-${collection.id}-title`}>
                <div className="ccic-collection-heading">
                  <h2 id={`school-${collection.id}-title`}>{collection.title}</h2>
                  <p>{collection.description}</p>
                </div>

                {collectionBoxes.length ? (
                  <div className="ccic-gallery-grid">
                    {collectionBoxes.map((box) => (
                      <SchoolBoxGalleryCard
                        key={box.id}
                        box={box}
                        quantityLabel={`${box.title} boxes`}
                        quantity={0}
                        maxQuantity={maxQuantityForBox(box.id)}
                        onQuantityChange={() => {}}
                      />
                    ))}
                  </div>
                ) : null}

                {collectionBoxes.length === 4 ? (
                  <article className={`ccic-school-mixed-box ${mixedQuantity > 0 ? 'is-selected' : ''}`}>
                    <div className="ccic-school-mixed-copy">
                      <p className="ccic-school-mixed-kicker">{collection.title} Mixed Box</p>
                      <strong>3 of each design</strong>
                      <p className="ccic-product-kicker">{mixedSku}</p>
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
                      <QuantityControl
                        label={`${collection.title} mixed boxes`}
                        value={mixedQuantity}
                        onChange={(quantity) => setMixedQuantities((current) => ({ ...current, [collection.id]: quantity }))}
                      />
                    </div>
                  </article>
                ) : null}
              </section>
            )
          })}
        </div>
      </div>
    </section>
  )
}
