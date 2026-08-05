import Image from 'next/image'
import StorefrontOrderBuilder from '../christmas-cards/storefront-order-builder'
import PaymentOptionsDetails from '../christmas-cards/payment-options-details'
import {
  CHRISTMAS_CARD_BOXES,
  CHRISTMAS_CARD_COLLECTIONS,
  CHRISTMAS_CARD_CURATED_CASES,
  CHRISTMAS_CARD_ORDER_CONFIG,
} from '@/lib/christmas-cards/catalog'
import '../christmas-cards/storefront.css'
import '../christmas-cards/payment-polish.css'
import '../christmas-cards/storefront-redesign.css'
import '../christmas-cards/storefront-header-polish.css'

export const metadata = {
  title: 'Christmas Cards Made for Ministry | Celebrate Christ in Christmas',
  description: 'Meaningful Christmas cards for faith communities, churches, parishes, and ministries.',
}

export default function CcicPage() {
  return (
    <main className="ccic-page">
      <header className="ccic-site-header">
        <div className="ccic-site-header-inner">
          <span aria-hidden="true" className="ccic-header-spacer" />
          <Image
            src="/CCiC.png"
            alt={CHRISTMAS_CARD_ORDER_CONFIG.brandName}
            width={176}
            height={176}
            priority
            className="ccic-header-logo"
          />
          <a className="ccic-header-cart-link" href="#order-summary" aria-label="Review order">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7" />
              <circle cx="10" cy="19" r="1.25" />
              <circle cx="17" cy="19" r="1.25" />
            </svg>
          </a>
        </div>
      </header>

      <section className="ccic-hero-image" aria-label="Christmas card collection preview">
        <div className="ccic-hero-image-wrap">
          <Image
            src="/Cards_Selection_Tile.jpg"
            alt="Selection of Celebrate Christ in Christmas greeting cards"
            fill
            priority
            sizes="100vw"
            className="ccic-hero-image-asset"
          />
        </div>
      </section>

      <section className="ccic-intro">
        <div className="ccic-intro-heading">
          <p className="ccic-eyebrow">Celebrate Christ in Christmas</p>
          <h1>Perfect for churches, parishes, councils, and ministries.</h1>
          <p>Simple to order, meaningful to share, and designed for faith communities.</p>
        </div>

        <div className="ccic-trust-grid">
          <article>
            <strong>Meaningful Christmas cards</strong>
            <p>Faith-centered designs paired with psalms and Scripture verses.</p>
          </article>
          <article>
            <strong>No payment collected online</strong>
            <p><PaymentOptionsDetails /></p>
          </article>
          <article>
            <strong>Designed and printed in Canada</strong>
            <p>Produced in Canada on FSC certified paper.</p>
          </article>
        </div>
      </section>

      <StorefrontOrderBuilder
        cases={CHRISTMAS_CARD_CURATED_CASES}
        boxes={CHRISTMAS_CARD_BOXES}
        collections={CHRISTMAS_CARD_COLLECTIONS}
      />

      <footer className="ccic-footer ccic-footer-powered">
        <span>Powered by</span>
        <a href="https://www.chrismworks.com" aria-label="Visit Chrism">
          <Image src="/Chrism.png" alt="Chrism" width={156} height={67} className="ccic-footer-logo" />
        </a>
      </footer>
    </main>
  )
}
