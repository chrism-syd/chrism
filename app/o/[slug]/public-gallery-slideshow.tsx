'use client'

import { useEffect, useMemo, useState } from 'react'

type PublicGalleryImage = {
  id: string
  title: string | null
  url: string
}

type PublicGallerySlideshowProps = {
  images: PublicGalleryImage[]
}

const AUTO_ADVANCE_MS = 5600

export default function PublicGallerySlideshow({ images }: PublicGallerySlideshowProps) {
  const galleryImages = useMemo(() => images.filter((image) => image.url), [images])
  const [activeIndex, setActiveIndex] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

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
  }, [modalOpen, galleryImages.length])

  if (galleryImages.length === 0) return null

  const activeImage = galleryImages[activeIndex] ?? galleryImages[0]

  function showPrevious() {
    setActiveIndex((currentIndex) => (currentIndex - 1 + galleryImages.length) % galleryImages.length)
  }

  function showNext() {
    setActiveIndex((currentIndex) => (currentIndex + 1) % galleryImages.length)
  }

  return (
    <>
      <button
        type="button"
        className="local-page-gallery"
        onClick={() => setModalOpen(true)}
        aria-label="Open gallery"
      >
        {galleryImages.map((image, index) => (
          <img
            key={image.id}
            src={image.url}
            alt=""
            className={`local-page-gallery-image${index === activeIndex ? ' is-active' : ''}`}
          />
        ))}
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
          <div className="local-page-gallery-modal-panel">
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
            {activeImage.title ? <p className="local-page-gallery-modal-title">{activeImage.title}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
