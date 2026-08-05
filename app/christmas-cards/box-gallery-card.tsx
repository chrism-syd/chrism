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
}: {
  box: ChristmasCardBox
  quantityLabel: string
  quantity: number
  onQuantityChange: (quantity: number) => void
  showPrice?: boolean
}) {
  const thumbnailUrl = box.frontImageUrl ?? box.outsideImageUrl ?? box.insideImageUrl

  return (
    <article className={`ccic-gallery-card ${quantity > 0 ? 'is-selected' : ''}`}>
      <CardArt
        title={box.title}
        imageUrl={thumbnailUrl}
        images={[
          { label: 'Front', url: box.frontImageUrl ?? box.outsideImageUrl },
          { label: 'Inside', url: box.insideImageUrl },
          { label: 'Outside', url: box.outsideImageUrl },
        ]}
      />
      <div className="ccic-gallery-copy">
        <h3>{box.title}</h3>
        <p className="ccic-product-kicker">{box.sku}</p>
        <p>{box.cardsPerBox} cards and envelopes</p>
        {showPrice ? <strong>{formatChristmasCardMoney(box.priceCents)}</strong> : null}
        {box.isCasePricingEligible ? <span className="ccic-case-badge">Case pricing eligible</span> : null}
      </div>
      <QuantityControl label={quantityLabel} value={quantity} onChange={onQuantityChange} />
    </article>
  )
}
