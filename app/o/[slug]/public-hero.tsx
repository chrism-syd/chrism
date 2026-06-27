const HERO_VIDEO_SRC = '/o/assets/73228-548173103.mp4'

type PublicHeroProps = {
  displayTitle: string
  displayName: string
  subtitle: string
  aboutCopy: string
}

export default function PublicHero({ displayTitle, displayName, subtitle, aboutCopy }: PublicHeroProps) {
  return (
    <section className="local-page-hero">
      <div className="local-page-hero-copy">
        <h1 className="local-page-hero-title">
          Welcome to {displayTitle}
        </h1>
        <p className="local-page-hero-subtitle">
          {subtitle}
        </p>
        <div className="local-page-action-row">
          <a href="#contact" className="qv-link-button qv-button-primary">Get Involved</a>
        </div>
      </div>

      <div className="local-page-hero-visual">
        <div className="local-page-hero-video-frame">
          <video
            src={HERO_VIDEO_SRC}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-label={`${displayName} community service video`}
            className="local-page-hero-video"
          />
        </div>
        <div id="about" className="local-page-about-card">
          <p className="local-page-about-copy">
            {aboutCopy}
          </p>
        </div>
      </div>
    </section>
  )
}
