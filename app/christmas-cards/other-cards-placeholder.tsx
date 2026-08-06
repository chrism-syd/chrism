const PLACEHOLDER_COUNT = 4

export default function OtherCardsPlaceholder() {
  return (
    <section className="ccic-other-cards-shell" aria-labelledby="other-cards-title">
      <div className="ccic-other-cards-inner">
        <div className="ccic-collection-heading">
          <h2 id="other-cards-title">Other Cards</h2>
          <p>
            Sold by the box for $9.00 and not included in case pricing.
          </p>
        </div>

        <div className="ccic-gallery-grid">
          {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
            <article className="ccic-gallery-card ccic-other-card-placeholder" key={index}>
              <div className="ccic-other-card-placeholder-art" aria-hidden="true">
                <span>Artwork coming soon</span>
              </div>
              <div className="ccic-gallery-copy">
                <h3>Other card</h3>
                <p className="ccic-product-kicker">Details coming soon</p>
                <strong>$9.00 per box</strong>
              </div>
              <span className="ccic-coming-soon-pill">Coming soon</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
