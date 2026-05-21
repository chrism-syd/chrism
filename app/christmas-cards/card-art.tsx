'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

type CardArtImage = {
  label: string
  url: string | null
}

type CardArtProps = {
  title: string
  imageUrl: string | null
  images?: CardArtImage[]
  size?: 'large' | 'small'
}

export default function CardArt({ title, imageUrl, images, size = 'large' }: CardArtProps) {
  const [failed, setFailed] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const availableImages = useMemo(() => {
    const source = images?.length ? images : [{ label: 'Front', url: imageUrl }]
    return source.filter((item): item is { label: string; url: string } => Boolean(item.url))
  }, [imageUrl, images])

  const canOpen = availableImages.length > 0 && !failed
  const activeImage = availableImages[activeIndex] ?? availableImages[0]

  function openLightbox() {
    if (!canOpen) return
    setActiveIndex(0)
    setIsOpen(true)
  }

  if (!imageUrl || failed) {
    return (
      <div className={`ccic-card-art ccic-card-art-${size} is-placeholder`} aria-label={`${title} artwork placeholder`}>
        <span>Card image coming soon</span>
      </div>
    )
  }

  return (
    <>
      <button type="button" className={`ccic-card-art-button ccic-card-art-${size}`} onClick={openLightbox} aria-label={`Quick view ${title}`}>
        <span className="ccic-card-art">
          <Image
            src={imageUrl}
            alt={`${title} card front`}
            fill
            sizes={size === 'small' ? '120px' : '(max-width: 640px) 100vw, 280px'}
            onError={() => setFailed(true)}
          />
          <span className="ccic-quick-view">Quick View</span>
        </span>
      </button>

      {isOpen && activeImage ? (
        <div className="ccic-lightbox" role="dialog" aria-modal="true" aria-label={`${title} quick view`}>
          <button type="button" className="ccic-lightbox-backdrop" aria-label="Close quick view" onClick={() => setIsOpen(false)} />
          <div className="ccic-lightbox-panel">
            <div className="ccic-lightbox-header">
              <div>
                <p className="ccic-eyebrow">Card preview</p>
                <h2>{title}</h2>
              </div>
              <button type="button" className="ccic-lightbox-close" onClick={() => setIsOpen(false)} aria-label="Close quick view">
                ×
              </button>
            </div>

            <div className="ccic-lightbox-image-wrap">
              <Image src={activeImage.url} alt={`${title} ${activeImage.label}`} fill sizes="(max-width: 900px) 92vw, 760px" />
            </div>

            <div className="ccic-lightbox-tabs" aria-label="Preview images">
              {availableImages.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  className={index === activeIndex ? 'is-active' : ''}
                  onClick={() => setActiveIndex(index)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
