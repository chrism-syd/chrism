import Image from 'next/image'
import Link from 'next/link'
import InvoiceReviewCta from '@/app/invoice-review-cta'
import styles from './chrism-works-business-draft.module.css'

function noOrphan(text: string) {
  return text.replace(/\s+(\S+)$/, '\u00a0$1')
}

const touchpoints = [
  'Signs and window graphics',
  'Business cards and stationery',
  'Menus, flyers, and mailers',
  'Staff apparel and uniforms',
  'Labels, stickers, and packaging',
  'Banners, booths, and event pieces',
  'Promotional products and client gifts',
  'Print-ready design and file setup',
]

const serviceGroups = [
  {
    title: 'Print and stationery',
    copy:
      'Business cards, postcards, flyers, brochures, rack cards, menus, forms, envelopes, letterhead, booklets, labels, stickers, and everyday printed pieces.',
  },
  {
    title: 'Signs and displays',
    copy:
      'Banners, coroplast signs, window graphics, posters, decals, event signage, yard signs, retractable displays, and large-format print.',
  },
  {
    title: 'Apparel and uniforms',
    copy:
      'T-shirts, hoodies, crewnecks, polos, staff shirts, event apparel, team wear, embroidered pieces, and branded workwear.',
  },
  {
    title: 'Promotional sourcing',
    copy:
      'Drinkware, tote bags, pens, lanyards, notebooks, magnets, giveaways, client gifts, and branded merchandise sourced through commercial suppliers.',
  },
]

const processSteps = [
  {
    title: 'Send the need',
    copy:
      'Share a finished file, a rough idea, a photo, an old invoice, or a simple message that starts with “can you make this?”',
  },
  {
    title: 'Get practical options',
    copy:
      'We help sort out the right product, material, quantity, production method, timeline, and budget before anything gets ordered.',
  },
  {
    title: 'Approve the quote',
    copy:
      'You get clear pricing and guidance. If there is a smarter way to produce the job, we will tell you before the dollars march out the door.',
  },
  {
    title: 'Let us handle production',
    copy:
      'Chrism manages file prep, sourcing, production, and coordination so you are not stuck chasing a tiny parade of vendors.',
  },
]

const faqs = [
  {
    question: 'What kind of businesses can Chrism help?',
    answer:
      'Chrism is built for small businesses, independent operators, restaurants, shops, service businesses, trades, local brands, and community-facing organizations that need design and production help without hiring an agency.',
  },
  {
    question: 'Do I need print-ready artwork?',
    answer:
      'No. If you have finished artwork, great. If you only have an idea, an old file, a screenshot, or a previous invoice, Chrism can help turn that into something production-ready.',
  },
  {
    question: 'Can you beat my current vendor?',
    answer:
      'Sometimes. Send your last quote or invoice and we can compare it honestly. If you already have strong pricing, we will say so. If there is room to improve, we will show you where.',
  },
  {
    question: 'Is Chrism a printer?',
    answer:
      'Chrism is a design and sourcing partner, not a single print shop. That means we can help match the job to the right production supplier instead of forcing every order through one machine or method.',
  },
  {
    question: 'Do you still work with ministries and schools?',
    answer:
      'Yes. Chrism still supports ministries, parishes, councils, schools, parent groups, and community organizations. This page is the broader small-business front door, with dedicated pages for specific audiences coming next.',
  },
]

function StickyAudienceMenu() {
  return (
    <div className={styles.stickyAudienceShell}>
      <nav className={styles.stickyAudienceNav} aria-label="Sticky audience navigation">
        <Link href="/business-draft" className={styles.stickyBrand} aria-current="page">
          <Image
            src="/chrismworks.svg"
            alt="Chrismworks"
            width={260}
            height={64}
            className={styles.stickyWordmarkImage}
          />
        </Link>
        <span className={styles.stickyFor}>for</span>
        <Link href="/business-draft" className={styles.stickyCurrent} aria-current="page">
          Business
        </Link>
        <span className={styles.stickyDivider}>|</span>
        <Link href="#" className={styles.stickyLink}>
          Ministry
        </Link>
        <span className={styles.stickyDivider}>|</span>
        <Link href="/schools" className={styles.stickyLink}>
          Schools
        </Link>
      </nav>
    </div>
  )
}

export default function ChrismWorksBusinessDraftPage() {
  return (
    <main className={`qv-page ${styles.page}`}>
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
            <h1 className={styles.heroTitle}>{noOrphan('Your brand often meets customers before you do.')}</h1>
            <p className={styles.heroText}>
              {noOrphan(
                'We help produce the everyday pieces people see — print, signage, apparel, packaging, promotional products — through practical design and sourcing built on volume pricing.'
              )}
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

        <StickyAudienceMenu />

        <section className={styles.calloutSection}>
          <Image
            src="/divazus-fabric-store-fFgbmj3vix4-unsplash.jpg"
            alt="Close-up of patterned fabric and apparel details"
            fill
            className={styles.calloutImage}
            sizes="(max-width: 900px) 100vw, 1200px"
          />
          <div className={styles.calloutOverlay} />
          <h2>{noOrphan('Everything your small business needs to look professional and get noticed.')}</h2>
          <p className={styles.imageCredit}>
            Photo by{' '}
            <a href="https://unsplash.com/@divazus?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer">
              Divazus Fabric Store
            </a>{' '}
            on{' '}
            <a href="https://unsplash.com/photos/a-close-up-of-a-tie-with-comic-books-on-it-fFgbmj3vix4?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer">
              Unsplash
            </a>
          </p>
        </section>

        <section className={styles.manifestoSection}>
          <div className={styles.sectionIntroWide}>
            <p className={styles.eyebrow}>Always showing up</p>
            <h2 className={styles.sectionTitle}>{noOrphan('Your brand is working before you are in the room.')}</h2>
            <p>
              {noOrphan(
                'The sign above the door, the card in someone’s hand, the shirt your staff wears, the flyer on a fridge, the sticker sealing a package, and the banner at an event all say something before you get the chance to.'
              )}
            </p>
            <p>
              {noOrphan(
                'Chrism helps make those pieces feel considered, consistent, and properly produced without making you manage five separate suppliers.'
              )}
            </p>
          </div>

          <div className={styles.touchpointGrid}>
            {touchpoints.map((touchpoint) => (
              <div key={touchpoint} className={styles.touchpointPill}>
                {touchpoint}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.servicesSection}>
          <div className={styles.sectionIntroWide}>
            <p className={styles.eyebrow}>What we help with</p>
            <h2 className={styles.sectionTitle}>{noOrphan('One practical partner for the pieces your business needs.')}</h2>
          </div>

          <div className={styles.serviceGrid}>
            {serviceGroups.map((group) => (
              <article key={group.title} className={styles.serviceCard}>
                <h3>{group.title}</h3>
                <p>{noOrphan(group.copy)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.invoiceBand} id="invoice-review">
          <div className={styles.invoiceBandIntro}>
            <p className={styles.eyebrow}>Already have a supplier?</p>
            <h2 className={styles.sectionTitle}>{noOrphan('Send us your last quote or invoice.')}</h2>
            <p>
              {noOrphan(
                'Maybe we can beat it. Maybe your current vendor is already giving you a great deal. Either way, you will get a useful second set of eyes.'
              )}
            </p>
            <Link href="#quote" className={`qv-button qv-link-button ${styles.invoiceBandButton}`}>
              Request a quote
            </Link>
          </div>
        </section>

        <section className={styles.processSection}>
          <div className={styles.sectionIntroWide}>
            <p className={styles.eyebrow}>How it works</p>
            <h2 className={styles.sectionTitle}>{noOrphan('A simpler way to get branded things made.')}</h2>
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

        <section className={styles.plainTrust}>
          <div className={styles.trustIntro}>
            <p className={styles.eyebrow}>Why Chrism</p>
            <h2 className={styles.trustTitle}>Lean, local, and useful.</h2>
          </div>
          <div className={styles.copyStack}>
            <p>
              {noOrphan(
                'Chrism is a registered Ontario business built for practical, relationship-based service. You get one point of contact who understands design, print files, production constraints, sourcing, and small-business budgets.'
              )}
            </p>
            <p>
              {noOrphan(
                'The goal is not to turn every request into a bloated agency project. The goal is to help you get the right thing made properly, at a fair price, with less vendor soup.'
              )}
            </p>
            <p>
              {noOrphan(
                'Chrism also supports ministries, schools, councils, and community organizations, but the same production logic helps regular small businesses show up better too.'
              )}
            </p>
          </div>
        </section>

        <div className={styles.schoolsLinkCard}>
          <p>
            Chrism also works with <Link href="/schools">schools</Link>. A dedicated ministry page is coming next.
          </p>
        </div>

        <section className={styles.faqSection}>
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

        <section className={styles.ctaSection} id="quote">
          <InvoiceReviewCta />
        </section>
      </div>
    </main>
  )
}
