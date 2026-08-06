'use client'

import CardArt from './card-art'
import QuantityControl from './quantity-control'
import { formatChristmasCardMoney, type ChristmasCardBox } from '@/lib/christmas-cards/catalog'

export default function BoxGalleryCard({
  box,
  quantityLabel,
  quantity,
  onQuantityChange,
  showPrice = true,
  maxQuantity = 999,
}: {
  box: ChristmasCardBox
  quantityLabel: string
  quantity: number
  onQuantityChange: (quantity: number) => void
  showPrice?: boolean
  maxQuantity?: number
}) {
  const thumbnailUrl = box.frontImageUrl ?? box.outsideImageUrl ?? box.insideImageUrl
  const isSoldOut = maxQuantity <= 0
  const remainingQuantity = Math.max(0, maxQuantity - quantity)
  const showLowStock = maxQuantity > 0 && maxQuantity < 100

  return (
    <article className={`ccic-gallery-card ${quantity > 0 ? 'is-selected' : ''}${isSoldOut ? ' is-sold-out' : ''}`}>
      <CardArt
        title={box.title}
        imageUrl={thumbnailUrl}
        images={[
          { label: 'Cover', url: box.frontImageUrl ?? box.outsideImageUrl },
          { label: 'Inside', url: box.insideImageUrl },
          { label: 'Outside', url: box.outsideImageUrl },
        ]}
      />
      <div className="ccic-gallery-copy">
        <h3>{box.title}</h3>
        <p className="ccic-product-kicker">{box.sku}</p>
        {showPrice ? <strong>{formatChristmasCardMoney(box.priceCents)}</strong> : null}
      </div>
      {isSoldOut ? (
        <span className="ccic-sold-out-pill" role="status">Sold out</span>
      ) : (
        <>
          <QuantityControl
            label={quantityLabel}
            value={quantity}
            max={maxQuantity}
            onChange={onQuantityChange}
          />
          {showLowStock ? (
            <p className="ccic-low-stock-count" aria-live="polite">
              {remainingQuantity > 0
                ? `Only ${remainingQuantity} left`
                : 'All available boxes are in your cart'}
            </p>
          ) : null}
        </>
      )}
    </article>
  )
}
