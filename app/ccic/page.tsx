import Image from 'next/image'
import ChristmasCardsOrderBuilder from '../christmas-cards/order-builder'
import CardArt from '../christmas-cards/card-art'
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

export const metadata = {
  title: 'Christmas Cards Made for Ministry | Celebrate Christ in Christmas',
  description: 'Meaningful Christmas cards for faith communities, churches, parishes, and ministries.',
}

export default function CcicPage() {
  const heroBoxes = CHRISTMAS_CARD_BOXES.slice(0, 4)

  return (
    <main className="ccic-page">
      <header className="ccic-site-header">
        <div className="ccic-site-header-inner">
          <span aria-hidden="true" className="ccic-header-spacer" />
          <Image
            src="/CCiC.png"
            alt={CHRISTMAS_CARD_ORDER_CONFIG.brandName}
            width={124}
            height={124}
            priority
            className="ccic-header-logo"
          />
          <a className="ccic-header-order-link" href="#order-summary">
            Review order
          </a>
        </div>
      </header>

      <section className="ccic-hero-gallery" aria-label="Christmas card collection preview">
        <div className="ccic-hero-gallery-inner">
          {heroBoxes.map((box) => (
            <CardArt
              key={`hero-${box.id}`}
              title={box.title}
              imageUrl={box.frontImageUrl ?? box.outsideImageUrl ?? box.insideImageUrl}
              images={[
                { label: 'Front', url: box.frontImageUrl ?? box.outsideImageUrl },
                { label: 'Inside', url: box.insideImageUrl },
                { label: 'Outside', url: box.outsideImageUrl },
              ]}
            />
          ))}
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

      <ChristmasCardsOrderBuilder
        cases={CHRISTMAS_CARD_CURATED_CASES}
        boxes={CHRISTMAS_CARD_BOXES}
        collections={CHRISTMAS_CARD_COLLECTIONS}
      />

      <footer className="ccic-footer">
        <Image src="/CCiC.png" alt={CHRISTMAS_CARD_ORDER_CONFIG.brandName} width={82} height={82} />
        <span>Powered by</span>
        <Image src="/Chrism.png" alt="Chrism" width={132} height={57} className="ccic-footer-logo" />
      </footer>
    </main>
  )
}
