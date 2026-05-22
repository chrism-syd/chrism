import Image from 'next/image'
import ChristmasCardsOrderBuilder from './order-builder'
import StickyHeader from './sticky-header'
import {
  CHRISTMAS_CARD_BOXES,
  CHRISTMAS_CARD_CURATED_CASES,
  CHRISTMAS_CARD_ORDER_CONFIG,
} from '@/lib/christmas-cards/catalog'
import './storefront.css'

export const metadata = {
  title: 'Christmas Cards Made for Ministry | Celebrate Christ in Christmas',
  description: 'Meaningful Christmas cards for faith communities, churches, parishes, and ministries.',
}

export default function ChristmasCardsPage() {
  return (
    <main className="ccic-page">
      <StickyHeader brandName={CHRISTMAS_CARD_ORDER_CONFIG.brandName} />

      <section className="ccic-hero">
        <div className="ccic-hero-title-row">
          <Image
            id="ccic-hero-logo-anchor"
            src="/CCiC.png"
            alt={CHRISTMAS_CARD_ORDER_CONFIG.brandName}
            width={280}
            height={120}
            priority
            className="ccic-brand-logo"
          />
          <div>
            <p className="ccic-eyebrow">Christmas card ordering</p>
            <h1>Christmas cards made for ministry</h1>
          </div>
        </div>

        <div className="ccic-hero-copy">
          <p>
            Meaningful Christmas cards for faith communities. Traditional sacred imagery paired with psalms and Scripture verses. Perfect for churches, parishes, and ministries.
          </p>
        </div>
        <div className="ccic-hero-card" aria-label="Payment and order confirmation details">
          <strong>No payment collected online</strong>
          <span>Review your selections first.</span>
          <span>We confirm the final total, shipping, and payment instructions by email.</span>
        </div>
      </section>

      <section className="ccic-how">
        <h2>How ordering works</h2>
        <div className="ccic-steps">
          <div>
            <strong>1. Choose your cards</strong>
            <span>Select a curated case, make a custom selection, or add individual boxes.</span>
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
        <Image src="/Chrism.png" alt="Chrism" width={156} height={67} className="ccic-footer-logo" />
      </footer>
    </main>
  )
}
