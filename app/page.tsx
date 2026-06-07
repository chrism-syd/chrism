import Image from 'next/image'
import Link from 'next/link'
import styles from './about/about.module.css'

const valueCards = [
  {
    title: 'Community',
    copy:
      'Chrism helps ministries know their people, stay connected, coordinate volunteers, and strengthen the local relationships that make parish and community life real.',
  },
  {
    title: 'Faith',
    copy:
      'Chrism is shaped by a Catholic imagination: beautiful materials, future spiritual tools, and a practical respect for the sacred work ministries are already doing.',
  },
  {
    title: 'Service',
    copy:
      'Chrism reduces operational burden so leaders and volunteers can spend less time wrestling spreadsheets, vendors, and scattered systems, and more time serving people.',
  },
]

const ecosystemCards = [
  {
    title: 'Chrism Operations',
    eyebrow: 'Ministry OS',
    variant: 'operations',
    copy:
      'A streamlined coordination platform for member records, events, volunteers, communication, and local organization context.',
  },
  {
    title: 'Chrism Commerce',
    eyebrow: 'Fundraising',
    variant: 'commerce',
    copy:
      'Premium Christmas cards, sacramental certificates, and print collateral designed to honor the dignity of the mission while creating strong local fundraising opportunities.',
  },
  {
    title: 'Chrism Brokerage',
    eyebrow: 'Print Sourcing',
    variant: 'brokerage',
    copy:
      'Commercial print, signage, apparel, and procurement sourcing through trade-aware production partners that help institutions avoid unnecessary retail markup.',
  },
] as const

function pillarTagClass(variant: (typeof ecosystemCards)[number]['variant']) {
  if (variant === 'operations') return styles.pillarTagOperations
  if (variant === 'commerce') return styles.pillarTagCommerce
  return styles.pillarTagBrokerage
}

const flywheelSteps = [
  {
    title: 'Broker',
    copy: 'We source and manage production for print, signage, apparel, and institutional collateral.',
  },
  {
    title: 'Fuel',
    copy: 'Commercial sourcing margin is redirected into the Chrism ecosystem instead of leaving the community.',
  },
  {
    title: 'Subsidize',
    copy: 'That value helps keep ministry software free or deeply subsidized for local organizations.',
  },
]

const faqs = [
  {
    question: 'How is Chrism free for ministries?',
    answer:
      'Chrism uses commercial print sourcing, fundraising products, and procurement margin to subsidize the software platform. The goal is to let commercial activity support ministry infrastructure instead of asking every small ministry to carry another software bill.',
  },
  {
    question: 'What does Chrism offer?',
    answer:
      'Chrism offers ministry software for member management, events, volunteer coordination, communication, and local organization context. It also supports print sourcing, fundraising products, sacramental materials, and institutional procurement work.',
  },
  {
    question: 'What kind of print work can Chrism source?',
    answer:
      'Chrism can help source Christmas cards, certificates, postcards, signs, banners, apparel, forms, bulletins, fundraising materials, and other institutional print needs.',
  },
  {
    question: 'How does Chrism help fundraising?',
    answer:
      'Chrism designs and sources premium goods at wholesale or trade-aware pricing so local groups can sell them at healthy margins. The model is especially useful for products like Christmas cards, where strong design and production quality can become a real fundraising advantage.',
  },
  {
    question: 'Does Chrism replace parish systems?',
    answer:
      'No. Chrism is best understood as a practical coordination layer for ministries, councils, volunteers, events, members, and local leadership. It is meant to reduce everyday friction, not replace every system a parish or organization already uses.',
  },
  {
    question: 'How does Chrism protect user information?',
    answer:
      'Chrism uses passwordless authentication, secure HTTPS, responsible access controls, and organization-based permissions. User information is shared only with organizations a user belongs to or chooses to connect with.',
  },
  {
    question: 'Can my council, parish, school, or organization request a quote?',
    answer:
      'Yes. Chrism can review existing print or sourcing needs and provide a comparison quote so your organization can see whether there is a meaningful savings opportunity.',
  },
]

export default function LandingPage() {
  return (
    <main className="qv-page">
      <div className={`qv-shell ${styles.aboutShell}`}>
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

          <Link href="/operations" className={`qv-button-secondary qv-link-button ${styles.signInButton}`}>
            Launch Operations
          </Link>
        </header>

        <section className={styles.heroBlock}>
          <h1 className={styles.heroTitle}>
            Built for community.
            <br />
            Optimized for business.
          </h1>
          <p className={styles.heroLead}>
            Chrism bridges commercial enterprise and community stewardship so operational capital can stay closer to the
            ministries, schools, councils, and local organizations doing the work on the ground.
          </p>
        </section>

        <section className={styles.visionGrid}>
          <div className={styles.imageColumn}>
            <div className={styles.imageFrame}>
              <Image
                src="/jonny-gios-QMesAlxmi6g-unsplash.jpg"
                alt="Large mural text reading you and me"
                fill
                className={styles.aboutImage}
                sizes="(max-width: 900px) 100vw, 38vw"
              />
            </div>
            <p className={styles.photoCredit}>
              Photo by{' '}
              <a
                href="https://unsplash.com/@supergios?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                target="_blank"
                rel="noreferrer"
              >
                Jonny Gios
              </a>{' '}
              on{' '}
              <a
                href="https://unsplash.com/photos/a-black-and-white-sign-that-says-you-and-me-and-you-and-me-QMesAlxmi6g?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                target="_blank"
                rel="noreferrer"
              >
                Unsplash
              </a>
            </p>
          </div>

          <section className={styles.contentPlain}>
            <p className={styles.eyebrow}>Why Chrism exists</p>
            <h2 className={styles.sectionTitle}>
              The organizations holding communities together deserve better tools — and better economics.
            </h2>
            <div className={styles.copyStack}>
              <p>
                Educators, faith communities, and the people who quietly keep local institutions running are doing some of
                the most important work in any community. Most of them never set out to run an organization — they set out
                to serve people. But here they are, juggling a patchwork of tools, bootstrapping on free tiers, and spending
                time on administration that should be going toward the people they&apos;re trying to reach.
              </p>
              <p>
                The infrastructure available to them was designed for businesses — not communities. The software assumes
                enterprise budgets. The pricing assumes high-volume buyers. And the gap between what&apos;s available and what&apos;s
                actually needed keeps falling on the people least positioned to absorb it.
              </p>
              <p>
                Chrism exists to close that gap. Operations software, fundraising goods, and institutional print sourcing —
                connected in one place, so more value stays with the organizations doing the work.
              </p>
            </div>
          </section>
        </section>

        <section className={styles.valuesSection}>
          <div className={styles.sectionIntroWide}>
            <p className={styles.eyebrow}>What Drives Us</p>
            <h2 className={styles.sectionTitle}>Community, Faith, and Service</h2>
            <p>
              These are not side themes. They are the reason Chrism exists, and the reason our tools are built around the
              day-to-day reality of ministries, councils, schools, volunteers, and local leaders.
            </p>
          </div>

          <div className={styles.cardGrid}>
            {valueCards.map((value) => (
              <article key={value.title} className={styles.valueCard}>
                <h3>{value.title}</h3>
                <p>{value.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.platformSection}>
          <div className={styles.sectionIntroWide}>
            <p className={styles.eyebrow}>The Ecosystem</p>
            <h2 className={styles.sectionTitle}>Three connected parts. One purpose.</h2>
            <p>
              Chrism connects software, commerce, and sourcing so ministry support is not dependent on yet another isolated
              subscription or one-off vendor relationship.
            </p>
          </div>

          <div className={styles.pillarColumns}>
            {ecosystemCards.map((card) => (
              <article key={card.title} className={styles.pillarColumn} id={card.title === 'Chrism Brokerage' ? 'sourcing' : undefined}>
                <p className={`${styles.pillarTag} ${pillarTagClass(card.variant)}`}>{card.eyebrow}</p>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.flywheelSection}>
          <div className={styles.sectionIntroWide}>
            <p className={styles.eyebrow}>The Flywheel</p>
            <h2 className={styles.sectionTitle}>How the model works</h2>
            <p>
              Commercial print and sourcing work creates margin. Instead of extracting that value away from the community,
              Chrism redirects it into tools, services, and fundraising mechanisms that support the community.
            </p>
          </div>

          <div className={styles.flowGrid}>
            {flywheelSteps.map((step, index) => (
              <article key={step.title} className={styles.flowItem}>
                <p className={styles.flowNumber}>{String(index + 1).padStart(2, '0')}</p>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>

          <div className={styles.freeBanner}>
            <h3 className={styles.freeBannerTitle}>Chrism&apos;s core functionality will always be FREE.</h3>
            <div className={styles.freeBannerCopy}>
              <p>
                The essential tools of member engagement and care will always be accessible to every ministry, not just the ones
                with a budget.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.trustBand}>
          <div className={styles.trustIntro}>
            <p className={styles.eyebrow}>Trust</p>
            <h2 className={styles.trustTitle}>Responsible stewardship</h2>
          </div>
          <div className={styles.copyStack}>
            <p>
              Because Chrism bridges procurement, ministry coordination, and community management, the platform is built
              around practical security standards, including secure HTTPS, passwordless authentication, organization-based
              permissions, and modern email authentication practices.
            </p>
            <p>
              Chrism is an Ontario-registered sole proprietorship dedicated to keeping operational capital where it matters
              most: directly supporting your mission.
            </p>
          </div>
        </section>

        <section className={styles.faqSection}>
          <div className={styles.sectionIntroWide}>
            <h2 className={styles.sectionTitle}>Common questions</h2>
          </div>

          <div className={styles.faqList}>
            {faqs.map((faq) => (
              <details key={faq.question} className={styles.faqItem}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.ctaSection}>
          <p className={styles.eyebrow}>Next Step</p>
          <h2 className={styles.ctaTitle}>Ready to optimize your organization&apos;s ecosystem?</h2>
          <div className={styles.ctaActions}>
            <Link href="#sourcing" className="qv-link-button qv-button-secondary">
              Explore Our Sourcing Network
            </Link>
            <Link href="mailto:syd.fernandez@chrism.app?subject=Chrism%20comparison%20quote" className="qv-link-button qv-button-secondary">
              Get a Comparison Quote
            </Link>
            <Link href="/operations" className="qv-link-button qv-button-primary">
              Launch Operations
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
