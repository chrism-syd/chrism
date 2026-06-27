import PublicGallerySlideshow from './public-gallery-slideshow'

type GalleryImage = {
  id: string
  title: string | null
  url: string
}

type PublicStoryProps = {
  galleryImages: GalleryImage[]
  communityText: string
}

export default function PublicStory({ galleryImages, communityText }: PublicStoryProps) {
  return (
    <section className="local-page-story-section" aria-label="Local community story">
      <div className="local-page-story-grid">
        <div className="local-page-story-visual" aria-label="Community image gallery">
          {galleryImages.length > 0 ? (
            <PublicGallerySlideshow images={galleryImages} />
          ) : (
            <div className="local-page-story-placeholder">
              <span>Image area</span>
            </div>
          )}
        </div>

        <section className="local-page-story-copy">
          <p className="qv-eyebrow">Community life</p>
          <h2 className="qv-section-title local-page-section-title-tight">A place for service, faith, and fellowship.</h2>
          <p className="qv-section-subtitle local-page-story-subtitle">{communityText}</p>

          <div className="local-page-story-card-grid">
            <div className="local-page-story-card">
              <strong>Serve locally</strong>
              <p>Find practical ways to help neighbours, families, and local community efforts.</p>
            </div>
            <div className="local-page-story-card">
              <strong>Stay connected</strong>
              <p>Keep an eye on upcoming events, meetings, and opportunities to take part.</p>
            </div>
            <div className="local-page-story-card">
              <strong>Build community</strong>
              <p>Meet people who are working together in faith, service, and friendship.</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
