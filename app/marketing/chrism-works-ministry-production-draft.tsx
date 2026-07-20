import Image from 'next/image'
import Link from 'next/link'
import InvoiceReviewCta from '@/app/invoice-review-cta'
import BusinessMotionObserver from './business-motion-observer'
import { ChrismWorksFooterLogo } from './chrism-works-audience-menu'
import styles from './chrism-works-business-draft.module.css'
import './audience-card-overrides.module.css'
import './business-motion.module.css'

function noOrphan(text: string) {
  return text.replace(/\s+(\S+)$/, '\u00a0$1')
}

const touchpointContinuationStyle = {
  marginTop: '-72px',
  padding: 'clamp(24px, 4vw, 42px)',
  border: '1px solid rgba(98, 62, 110, 0.16)',
  borderTop: 0,
  borderRadius: '0 0 30px 30px',
  background: 'rgba(255, 255, 255, 0.72)',
  boxShadow: 'none',
} as const

const ministryMaterials = [
  'Sacramental certificates',
  'Christmas cards',
  'Prayer cards and holy cards',
  'Parish event posters',
  'Youth ministry apparel',
  'Retreat shirts and hoodies',
  'Fundraising products',
  'Banners and signage',
  'Forms and stationery',
  'Welcome packages',
  'Volunteer materials',
  'Print-ready file setup',
]

const processSteps = [
  {
    title: 'Send the need',
    copy:
      'Share a finished file, an old template, a parish bulletin sample, a committee idea, or a simple message that starts with “can you make this?”',
  },
  {
    title: 'Shape the piece',
    copy:
      'We help turn the request into the right format, product, quantity, material, and production approach before anything gets ordered.',
  },
  {
    title: 'Approve the quote',
    copy:
      'You get clear pricing and practical guidance. If there is a better way to produce the job, we will say so before the budget disappears.',
  },
  {
    title: 'Let us handle production',
    copy:
      'Chrism manages file prep, sourcing, production, and coordination so ministry teams are not left chasing vendors between meetings.',
  },
]

const faqs = [
  {
    question: 'What kind of ministries can Chrism help?',
    answer:
      'Chrism can support parishes, councils, youth ministries, sacramental preparation teams, parish offices, schools-adjacent ministries, Catholic organizations, and local community groups that need print, apparel, signage, or fundraising materials produced well.',
  },
  {
    question: 'Do we need finished artwork?',
    answer:
      'No. Finished artwork is welcome, but Chrism can also work from an old file, a screenshot, a Word document, a rough idea, a previous invoice, or a committee sketch that needs to become production-ready.',
  },
  {
    question: 'Can Chrism help with fundraising products?',
    answer:
      'Yes. Chrism can help design, source, and produce fundraising products such as Christmas cards, apparel, printed goods, and other ministry-friendly items with quality and margin in mind.',
  },
  {
    question: 'Is this the same as Chrism.app?',
    answer:
      'This page is about ministry print, production, and sourcing. Chrism.app is the ministry-operations side: member management, events, volunteers, communication, and local organization tools.',
  },
]

export default function ChrismWorksMinistryProductionDraftPage() {
  return (
    <main className={`qv-page ${styles.page}`}>
      <BusinessMotionObserver />
      <div className={`qv-shell ${styles.shell}`}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.brandLink} aria-label="Chrism home">
            <Image
              src="/Chrism_horiz.svg"
              alt="Chrism"
              width={419}
              height={98}
              priority
              className={styles.brandImage}
            />
          </Link>
        </header>

        <section className={styles.heroBlock}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>{noOrphan('Ministry materials should feel worthy of the mission.')}</h1>
            <p className={styles.heroText}>
              Chrism helps ministries produce the everyday pieces people see and carry: print, signage, apparel, certificates, cards, fundraising
              products, and event materials. Behind each piece is <strong>creative direction</strong>, <strong>practical sourcing</strong>, and{' '}
              <strong>trade-aware production support</strong>.
            </p>
          </div>

          <div className={styles.heroArtwork}>
            <div className={styles.openSignFrame} aria-hidden="true">
              <Image
                src="/open_sign.svg"
                alt=""
                width={848}
                height={1264}
                priority
                className={styles.openSignImage}
              />
            </div>
          </div>
        </section>

        <section className={styles.calloutSection} style={{ borderBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, boxShadow: 'none' }}>
          <Image
            src="/jonny-gios-QMesAlxmi6g-unsplash-chrism.png"
            alt="Large mural text reading you and me"
            fill
            className={styles.calloutImage}
            sizes="(max-width: 900px) 100vw, 1200px"
          />
          <div className={styles.calloutOverlay} />
          <h2>
            Printed pieces can carry
            <br />
            care, trust,
            <br />
            and welcome.
          </h2>
          <p className={styles.imageCredit}>
            Photo by{' '}
            <a href="https://unsplash.com/@supergios?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer">
              Jonny Gios
            </a>{' '}
            on{' '}
            <a href="https://unsplash.com/photos/a-black-and-white-sign-that-says-you-and-me-and-you-and-me-QMesAlxmi6g?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer">
              Unsplash
            </a>
          </p>
        </section>

        <section className={styles.manifestoSection} style={touchpointContinuationStyle} data-scroll-motion="manifesto">
          <div className={styles.sectionIntroWide}>
            <p>
              {noOrphan(
                'The poster in the narthex, the shirt at a youth retreat, the certificate handed to a family, the card sold as a fundraiser, and the banner at an event all say something before anyone reads the details.'
              )}
            </p>
            <p>
              {noOrphan(
                'Chrism brings design and production judgment into those pieces from the start, then helps make them feel considered, consistent, and properly produced without asking volunteers or parish staff to manage a maze of suppliers.'
              )}
            </p>
            <p className={styles.manifestoClose}>{noOrphan('The goal is simple: help ministry show up with materials that feel cared for.')}</p>
          </div>

          <div className={styles.touchpointGrid} data-scroll-motion="pills">
            {ministryMaterials.map((item) => (
              <div key={item} className={styles.touchpointPill}>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.processSection} data-scroll-motion="process">
          <div className={styles.sectionIntroWide} style={{ justifyItems: 'center', margin: '0 auto', maxWidth: '980px', textAlign: 'center' }}>
            <h2 className={styles.sectionTitle}>{noOrphan('One practical partner for the pieces ministry needs.')}</h2>
            <p style={{ maxWidth: '1040px' }}>
              Chrism helps sort out what should be made, how it should be produced,
              <br />
              and whether there is a smarter way to source it. You get one point of contact who understands design,
              <br />
              print files, production constraints, sourcing, and ministry budgets.
            </p>
            <p style={{ maxWidth: '980px' }}>
              And yes, Chrism.app still has its own lane for ministry operations.{' '}
              <span className={styles.manifestoClose}>{noOrphan('This page is about getting the physical pieces made well.')}</span>
            </p>
          </div>

          <div className={styles.flowGrid}>
            {processSteps.map((step, index) => (
              <article key={step.title} className={styles.flowItem}>
                <p className={styles.flowNumber}>{String(index + 1).padStart(2, '0')}</p>
                <h3>
                  <span className={styles.accentWord}>{step.title}</span>
                </h3>
                <p>{noOrphan(step.copy)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.faqSection} data-scroll-motion="fade">
          <div className={styles.sectionIntroWide}>
            <h2 className={styles.sectionTitle}>{noOrphan('Common questions')}</h2>
          </div>

          <div className={styles.faqList}>
            {faqs.map((faq) => (
              <details key={faq.question} className={styles.faqItem}>
                <summary>{faq.question}</summary>
                <p>{noOrphan(faq.answer)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.ctaSection} id="quote" data-scroll-motion="fade">
          <InvoiceReviewCta />
        </section>

        <ChrismWorksFooterLogo />
      </div>
    </main>
  )
}
