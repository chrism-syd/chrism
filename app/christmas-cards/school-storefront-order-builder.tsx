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
        <div className="ccic-collections" id="school-card-selections">
          {sortedCollections.map((collection) => {
            const collectionBoxes = sortedBoxes.filter((box) => box.collectionId === collection.id)
            return (
              <section className="ccic-collection" key={collection.id} aria-labelledby={`school-${collection.id}-title`}>
                <div className="ccic-collection-heading">
                  <h2 id={`school-${collection.id}-title`}>{collection.title}</h2>
                  <p>{collection.description}</p>
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
