'use client'

import CardArt from './card-art'
import CustomizationToggle from './customization-toggle'
import QuantityControl from './quantity-control'
import { formatChristmasCardMoney, type ChristmasCardBox } from '@/lib/christmas-cards/catalog'

export default function BoxGalleryCard({
  box,
  quantityLabel,
  quantity,
  onQuantityChange,
  showPrice = true,
  customized,
  customizationDisabled,
  onCustomizedChange,
}: {
  box: ChristmasCardBox
  quantityLabel: string
  quantity: number
  onQuantityChange: (quantity: number) => void
  showPrice?: boolean
  customized: boolean
  customizationDisabled?: boolean
  onCustomizedChange: (checked: boolean) => void
}) {
  return (
    <article className="ccic-gallery-card">
      <CardArt
        title={box.title}
        imageUrl={box.frontImageUrl}
        images={[
          { label: 'Front', url: box.frontImageUrl },
          { label: 'Inside', url: box.insideImageUrl },
          { label: 'Outside', url: box.outsideImageUrl },
        ]}
      />
      <div className="ccic-gallery-copy">
        <p className="ccic-product-kicker">{box.sku}</p>
        <h3>{box.title}</h3>
        <p>{box.cardsPerBox} cards + envelopes per box</p>
        {showPrice ? <strong>{formatChristmasCardMoney(box.priceCents)} per box</strong> : null}
        <details className="ccic-inside-preview">
          <summary>Inside wording</summary>
          <p>{box.insideMessage}</p>
        </details>
        <CustomizationToggle checked={customized} disabled={customizationDisabled} onChange={onCustomizedChange} />
      </div>
      <QuantityControl label={quantityLabel} value={quantity} onChange={onQuantityChange} />
    </article>
  )
}
