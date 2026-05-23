import Image from 'next/image'
import ChristmasCardsOrderBuilder from './order-builder'
import PaymentOptionsDetails from './payment-options-details'
import StickyHeader from './sticky-header'
import {
  CHRISTMAS_CARD_BOXES,
  CHRISTMAS_CARD_CURATED_CASES,
  CHRISTMAS_CARD_ORDER_CONFIG,
} from '@/lib/christmas-cards/catalog'
import './storefront.css'
import './payment-polish.css'

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
            <h1>
              Christmas cards made<br />for ministry
            </h1>
          </div>
        </div>

        <div className="ccic-hero-copy">
          <p>
            Meaningful Christmas cards for faith communities. Beautiful, faith-centered designs paired with psalms and Scripture verses. Perfect for churches, parishes, and ministries.
          </p>
        </div>
        <div className="ccic-hero-card" aria-label="Payment and order confirmation details">
          <strong>No payment <span className="ccic-nowrap">collected online</span></strong>
          <PaymentOptionsDetails />
        </div>
      </section>

      <section className="ccic-trust-strip" aria-label="Product origin and paper certification">
        <div>
          <span className="ccic-maple-leaf" aria-hidden="true">🍁</span>
          <strong>Designed, sourced, and printed in Canada</strong>
        </div>
        <div>
          <span className="ccic-cert-mark" aria-hidden="true">FSC</span>
          <strong>Printed on FSC certified paper</strong>
        </div>
      </section>

      <section className="ccic-how">
        <h2>How ordering works</h2>
        <div className="ccic-steps">
          <div>
            <strong>1. Choose your cards</strong>
            <span>Select our curated case, or choose individual&nbsp;boxes.</span>
          </div>
          <div>
            <strong>2. Review your order</strong>
            <span>Review the summary of your selections and estimated&nbsp;total.</span>
          </div>
          <div>
            <strong>3. Place your order</strong>
            <span>Enter your contact information, confirm delivery pricing or local pick-up and submit your&nbsp;order.</span>
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
