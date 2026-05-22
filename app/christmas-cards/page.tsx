import Image from 'next/image'
import ChristmasCardsOrderBuilder from './order-builder'
import {
  CHRISTMAS_CARD_BOXES,
  CHRISTMAS_CARD_CURATED_CASES,
  CHRISTMAS_CARD_ORDER_CONFIG,
} from '@/lib/christmas-cards/catalog'
import './storefront.css'

export const metadata = {
  title: 'Celebrate Christ in Christmas | Christmas Cards',
  description: 'Catholic Christmas card cases and boxes for councils, parishes, and ministries.',
}

export default function ChristmasCardsPage() {
  return (
    <main className="ccic-page">
      <section className="ccic-hero">
        <div className="ccic-hero-copy">
          <div className="ccic-hero-title-row">
            <div>
              <p className="ccic-eyebrow">Catholic Christmas card ordering</p>
              <h1>{CHRISTMAS_CARD_ORDER_CONFIG.brandName}</h1>
            </div>
          </div>
          <p>
            Catholic Christmas card cases and boxes for councils, parishes, and ministries. Choose a ready-made case,
            build your own case, or order individual boxes.
          </p>
          <p className="ccic-hero-note">
            No payment is collected online. After you submit your order request, we will confirm the final total,
            shipping, and payment instructions by email.
          </p>
        </div>
        <div className="ccic-hero-card" aria-label="Ordering summary">
          <Image
            src="/CCiC.png"
            alt={CHRISTMAS_CARD_ORDER_CONFIG.brandName}
            width={210}
            height={90}
            priority
            className="ccic-brand-logo"
          />
          <strong>Simple ordering</strong>
          <span>35 boxes per case</span>
          <span>12 cards + envelopes per box</span>
          <span>Custom logo/text available</span>
        </div>
      </section>

      <section className="ccic-how">
        <h2>How ordering works</h2>
        <div className="ccic-steps">
          <div>
            <strong>1. Choose your cards</strong>
            <span>Select a ready-made case, build your own case, or add individual boxes.</span>
          </div>
          <div>
            <strong>2. Review your order</strong>
            <span>You will see your selections and estimated total before sending anything.</span>
          </div>
          <div>
            <strong>3. We confirm by email</strong>
            <span>We will confirm shipping, payment instructions, and timing before production.</span>
          </div>
        </div>
      </section>

      <ChristmasCardsOrderBuilder cases={CHRISTMAS_CARD_CURATED_CASES} boxes={CHRISTMAS_CARD_BOXES} />

      <footer className="ccic-footer">
        <span>Powered by</span>
        <Image src="/Chrism.png" alt="Chrism" width={130} height={56} className="ccic-footer-logo" />
      </footer>
    </main>
  )
}
