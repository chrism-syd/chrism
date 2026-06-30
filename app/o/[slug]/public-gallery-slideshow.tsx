'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type PublicGalleryImage = {
  id: string
  title: string | null
  url: string
}

type PublicGallerySlideshowProps = {
  images: PublicGalleryImage[]
}

const AUTO_ADVANCE_MS = 5600
const SWIPE_THRESHOLD_PX = 42

export default function PublicGallerySlideshow({ images }: PublicGallerySlideshowProps) {
  const galleryImages = useMemo(() => images.filter((image) => image.url), [images])
  const [activeIndex, setActiveIndex] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const showPrevious = useCallback(() => {
    setActiveIndex((currentIndex) => (currentIndex - 1 + galleryImages.length) % galleryImages.length)
  }, [galleryImages.length])

  const showNext = useCallback(() => {
    setActiveIndex((currentIndex) => (currentIndex + 1) % galleryImages.length)
  }, [galleryImages.length])

  useEffect(() => {
    if (galleryImages.length <= 1 || modalOpen) return

    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % galleryImages.length)
    }, AUTO_ADVANCE_MS)

    return () => window.clearInterval(timer)
  }, [galleryImages.length, modalOpen])

  useEffect(() => {
    if (!modalOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setModalOpen(false)
      if (event.key === 'ArrowLeft') showPrevious()
      if (event.key === 'ArrowRight') showNext()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [modalOpen, showNext, showPrevious])

  if (galleryImages.length === 0) return null

  const activeImage = galleryImages[activeIndex] ?? galleryImages[0]
  const galleryPositionLabel = `${activeIndex + 1} of ${galleryImages.length}`

  function handleTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null || galleryImages.length <= 1) return

    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current
    const deltaX = endX - touchStartX.current
    touchStartX.current = null

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return
    if (deltaX > 0) showPrevious()
    else showNext()
  }

  return (
    <>
      <button
        type="button"
        className="local-page-gallery"
        onClick={() => setModalOpen(true)}
        aria-label={`Open gallery, image ${galleryPositionLabel}`}
      >
        {galleryImages.map((image, index) => (
          <img
            key={image.id}
            src={image.url}
            alt=""
            className={`local-page-gallery-image${index === activeIndex ? ' is-active' : ''}`}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}
        <span className="local-page-gallery-count" aria-hidden="true">{galleryPositionLabel}</span>
        {galleryImages.length > 1 ? (
          <span className="local-page-gallery-dots" aria-hidden="true">
            {galleryImages.map((image, index) => (
              <span key={image.id} className={`local-page-gallery-dot${index === activeIndex ? ' is-active' : ''}`} />
            ))}
          </span>
        ) : null}
      </button>

      {modalOpen ? (
        <div className="local-page-gallery-modal" role="dialog" aria-modal="true" aria-label="Gallery image viewer">
          <button
            type="button"
            className="local-page-gallery-modal-backdrop"
            onClick={() => setModalOpen(false)}
            aria-label="Close gallery"
          />
          <div
            className="local-page-gallery-modal-panel"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button
              type="button"
              className="local-page-gallery-modal-close"
              onClick={() => setModalOpen(false)}
              aria-label="Close gallery"
            >
              ×
            </button>
            {galleryImages.length > 1 ? (
              <button
                type="button"
                className="local-page-gallery-modal-arrow local-page-gallery-modal-arrow-left"
                onClick={showPrevious}
                aria-label="Previous image"
              >
                ‹
              </button>
            ) : null}
            <div className="local-page-gallery-modal-image-wrap">
              <img src={activeImage.url} alt={activeImage.title ?? 'Gallery image'} />
            </div>
            {galleryImages.length > 1 ? (
              <button
                type="button"
                className="local-page-gallery-modal-arrow local-page-gallery-modal-arrow-right"
                onClick={showNext}
                aria-label="Next image"
              >
                ›
              </button>
            ) : null}
            <div className="local-page-gallery-modal-meta">
              <span>{galleryPositionLabel}</span>
              {activeImage.title ? <p className="local-page-gallery-modal-title">{activeImage.title}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
