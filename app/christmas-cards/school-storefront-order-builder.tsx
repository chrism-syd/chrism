'use client'

import { useMemo } from 'react'
import BoxGalleryCard from './box-gallery-card'
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

  function maxQuantityForBox(catalogId: string) {
    const availability = inventoryAvailability[catalogId]
    if (!availability) return 999
    if (!availability.isStoreEnabled) return 0
    return availability.availableBoxes === null ? 999 : availability.availableBoxes
  }

  return (
    <section className="ccic-shop-layout ccic-shop-layout-full" aria-label="School Christmas card catalogue">
      <div className="ccic-shop-main">
        <section className="ccic-ordering-steps" aria-labelledby="school-ordering-is-easy">
          <h2 id="school-ordering-is-easy">A simple school fundraiser</h2>
          <div>
            <article>
              <strong>1. Choose your cards</strong>
              <p>Browse all four Christmas card collections below.</p>
            </article>
            <article>
              <strong>2. Record your selections</strong>
              <p>Each box contains 12 cards and envelopes for $15.</p>
            </article>
            <article>
              <strong>3. Support your school</strong>
              <p>Orders are credited to your participating school fundraiser.</p>
            </article>
          </div>
        </section>

        <section className="ccic-custom-case-banner" aria-label="Mixed Christmas card boxes">
          <div>
            <span>New option</span>
            <strong>Mixed box</strong>
          </div>
          <div>
            <strong>Can't choose just one?</strong>
            <p>
              Each four-design collection is also available as a mixed box: 3 cards of each design, for 12 cards and 12 envelopes total. Same $15 box price.
            </p>
          </div>
        </section>

        <div className="ccic-collections" id="school-card-selections">
          {sortedCollections.map((collection) => {
            const collectionBoxes = sortedBoxes.filter((box) => box.collectionId === collection.id)
            return (
              <section className="ccic-collection" key={collection.id} aria-labelledby={`school-${collection.id}-title`}>
                <div className="ccic-collection-heading">
                  <h2 id={`school-${collection.id}-title`}>{collection.title}</h2>
                  <p>{collection.description}</p>
                  <p><strong>Available by individual design or as a mixed box with 3 of each design.</strong></p>
                </div>
                {collectionBoxes.length ? (
                  <div className="ccic-gallery-grid">
                    {collectionBoxes.map((box) => (
                      <BoxGalleryCard
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
              </section>
            )
          })}
        </div>
      </div>
    </section>
  )
}
