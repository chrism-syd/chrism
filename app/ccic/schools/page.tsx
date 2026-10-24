import Image from 'next/image'
import Link from 'next/link'
import { CCIC_SCHOOL_CAMPAIGNS, isCcicSchoolOrderingEnabled } from '@/lib/christmas-cards/schools'
import { CHRISTMAS_CARD_ORDER_CONFIG } from '@/lib/christmas-cards/catalog'
import '@/app/christmas-cards/storefront.css'
import '@/app/christmas-cards/payment-polish.css'
import '@/app/christmas-cards/storefront-redesign.css'
import '@/app/christmas-cards/storefront-header-polish.css'
import '@/app/christmas-cards/storefront-inventory.css'
import '@/app/christmas-cards/storefront-final-polish.css'
import '@/app/christmas-cards/school-storefront.css'
import './schools-landing.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'School Christmas Card Fundraisers | Celebrate Christ in Christmas',
  description: 'Find your school’s Celebrate Christ in Christmas card fundraiser and check when ordering is available.',
}

export default function CcicSchoolsLandingPage() {
  const schools = CCIC_SCHOOL_CAMPAIGNS.filter((school) => school.active).sort((a, b) => Number(isCcicSchoolOrderingEnabled(b)) - Number(isCcicSchoolOrderingEnabled(a)))
  return (
    <main className="ccic-page ccic-schools-landing">
      <header className="ccic-site-header">
        <div className="ccic-site-header-inner">
          <span aria-hidden="true" className="ccic-header-spacer" />
          <div className="ccic-schools-brand">
            <Link href="/ccic" aria-label="Celebrate Christ in Christmas home">
              <Image src="/CCiC.png" alt={CHRISTMAS_CARD_ORDER_CONFIG.brandName} width={160} height={160} priority className="ccic-header-logo" />
            </Link>
            <strong>School Christmas Card Fundraisers</strong>
          </div>
          <span aria-hidden="true" className="ccic-header-spacer" />
        </div>
      </header>
      <section className="ccic-hero-image" aria-label="Christmas card collection preview">
        <div className="ccic-hero-image-wrap">
          <Image src="/Cards_Selection_Tile.jpg" alt="Selection of Celebrate Christ in Christmas greeting cards" fill priority sizes="100vw" className="ccic-hero-image-asset" />
        </div>
      </section>
      <section className="ccic-schools-intro">
        <h1>Christmas Cards That Give Back to Our <span className="ccic-schools-headline-last">Schools.</span></h1>
        <p>Choose your school below to support its Christmas card fundraiser. Each school has its own ordering window.</p>
      </section>
      <section className="ccic-schools-list" aria-label="Participating schools">
        <div className="ccic-schools-grid">
          {schools.map((school) => {
            const open = isCcicSchoolOrderingEnabled(school)
            const preview = school.orderingEnabled !== true
            const upcoming = Boolean(school.orderingOpensAt && Date.now() < new Date(school.orderingOpensAt).getTime())
            return (
              <article className={`ccic-schools-card${open ? ' is-open' : ''}`} key={school.slug}>
                <h3>{school.name}</h3>
                <p className={open ? 'ccic-schools-status is-open' : 'ccic-schools-status'}>
                  {open ? 'Ordering now open' : preview || upcoming ? 'Ordering window not yet open' : 'Ordering window closed'}
                </p>
                <p>{open ? 'Order mixed Christmas card collections and support your school.' : preview || upcoming ? 'Your school’s fundraiser page is ready to preview. Orders will be accepted when the school opens its campaign.' : 'Thank you for supporting your school’s fundraiser.'}</p>
                <Link href={`/ccic/schools/${school.slug}`} className={`ccic-schools-action${open ? ' is-open' : ''}`}>
                  {open ? 'Shop this fundraiser' : 'View school page'}
                </Link>
              </article>
            )
          })}
        </div>
      </section>
      <section className="ccic-support-banner" aria-label="School fundraising message">
        <p>Thank you for helping keep Christ in Christmas while supporting our school communities.</p>
      </section>
      <footer className="ccic-footer ccic-footer-powered">
        <div className="ccic-footer-powered-center ccic-school-footer-partners">
          <a href="https://www.chrismworks.com" aria-label="Visit Chrism"><Image src="/Chrism.png" alt="Chrism" width={132} height={57} className="ccic-footer-logo" /></a>
          <span className="ccic-school-footer-separator" aria-hidden="true" />
          <a href="https://kofc7689.org" aria-label="Visit Knights of Columbus Council 7689"><Image src="/organizations/knights-of-columbus-logo.png" alt="Knights of Columbus" width={180} height={72} className="ccic-school-kofc-logo" /></a>
        </div>
      </footer>
    </main>
  )
}
