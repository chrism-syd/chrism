import Image from 'next/image'
import Link from 'next/link'
import styles from './about/about.module.css'
import InvoiceReviewCta from './invoice-review-cta'
import heroStyles from './landing-hero.module.css'

function noOrphan(text: string) {
  return text.replace(/\s+(\S+)$/, '\u00a0$1')
}

const flywheelSteps = [
  {
    title: 'Reach',
    copy: 'Chrism reaches organizations through software, fundraising goods, print sourcing, and practical operational support.',
  },
  {
    title: 'Redirect',
    copy: 'Commercial margin is redirected into the Chrism ecosystem instead of leaking away from the community.',
  },
  {
    title: 'Reinvest',
    copy: 'That value helps keep core tools free or deeply subsidized while funding better products, services, and support.',
  },
  {
    title: 'Repeat',
    copy:
      'Every order, every subscription, every sourcing request makes the ecosystem stronger. The more Chrism is used, the more it can do — for everyone in it.',
  },
]

const faqs = [
  {
    question: 'How is Chrism free for organizations?',
    answer:
      'Chrism uses commercial print sourcing, fundraising products, and procurement margin to subsidize the software platform. The goal is to let commercial activity support community infrastructure instead of asking every small organization to carry another software bill.',
  },
  {
    question: 'What does Chrism offer?',
    answer:
      'Chrism offers software for member management, events, volunteer coordination, communication, and local organization context. It also supports print sourcing, fundraising products, designed materials, and institutional procurement work.',
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
    question: 'Does Chrism replace existing systems?',
    answer:
      'No. Chrism is best understood as a practical coordination layer for organizations, members, leaders, volunteers, events, and local operations. It is meant to reduce everyday friction, not replace every system an organization already uses.',
  },
  {
    question: 'How does Chrism protect user information?',
    answer:
      'Chrism uses passwordless authentication, secure HTTPS, responsible access controls, and organization-based permissions. User information is shared only with organizations a user belongs to or chooses to connect with.',
  },
  {
    question: 'Can my organization request a quote?',
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

        <section className={`${styles.heroBlock} ${heroStyles.heroBlock}`}>
          <div className={heroStyles.heroCopy}>
            <h1 className={styles.heroTitle}>
              Built for
              <br />
              community.
              <br />
              <span className={heroStyles.heroAccent}>Optimized</span>
              <br />
              for business.
            </h1>
          </div>

          <div className={heroStyles.heroArtwork} aria-hidden="true">
            <Image
              src="/chair.png"
              alt=""
              width={780}
              height={780}
              priority
              className={heroStyles.heroChairImage}
            />
          </div>
        </section>

        <section className={`${styles.visionGrid} ${heroStyles.visionGridSix}`}>
          <div className={`${styles.imageColumn} ${heroStyles.visionImageColumn}`}>
            <div className={styles.imageFrame}>
              <Image
                src="/jonny-gios-QMesAlxmi6g-unsplash-chrism.png"
                alt="Large mural text reading you and me"
                fill
                className={styles.aboutImage}
                sizes="(max-width: 900px) 100vw, 32vw"
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

          <section className={`${styles.contentPlain} ${heroStyles.visionCopyColumn}`}>
            <p className={styles.eyebrow}>Why Chrism exists</p>
            <h2 className={`${styles.sectionTitle} ${heroStyles.visionTitle}`}>
              The people holding communities together{' '}
              <span className={heroStyles.noWrap}>
                deserve <span className={heroStyles.accentWord}>better.</span>
              </span>
            </h2>
            <div className={styles.copyStack}>
              <p>
                {noOrphan(
                  'Educators, ministry leaders, and the people who quietly keep local institutions running are doing some of the most important work in any community. Most never planned to run an organization — they wanted to serve people. Yet here they are, juggling a patchwork of tools, bootstrapping on free tiers, and watching the person they set out to be get kicked in the shins by everything that has nothing to do with why they showed up.'
                )}
              </p>
              <p>
                {noOrphan(
                  'The infrastructure available to them was designed for businesses — not communities. The software assumes enterprise budgets. The pricing assumes high-volume buyers. And the gap between what\'s available and what\'s actually needed keeps falling on the people least positioned to absorb it.'
                )}
              </p>
              <p>
                {noOrphan(
                  'Chrism exists to close that gap. Operations software, fundraising goods, and institutional print sourcing — connected in one place, so more value stays with the organizations doing the work.'
                )}
              </p>
            </div>
          </section>
        </section>

        <section className={styles.flywheelSection}>
          <div className={styles.sectionIntroWide}>
            <p className={styles.eyebrow}>The Flywheel</p>
            <h2 className={`${styles.sectionTitle} ${heroStyles.visionTitle}`}>Why the model works</h2>
            <p>
              {noOrphan(
                'Every vendor your organization deals with is running a business and extracting value from every transaction. So is Chrism.'
              )}
            </p>
            <p>{noOrphan('The difference is what we do with it.')}</p>
          </div>

          <div className={styles.flowGrid}>
            {flywheelSteps.map((step, index) => (
              <article key={step.title} className={styles.flowItem}>
                <p className={styles.flowNumber}>{String(index + 1).padStart(2, '0')}</p>
                <h3>{step.title}</h3>
                <p>{noOrphan(step.copy)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.trustBand}>
          <div className={styles.trustIntro}>
            <h2 className={styles.trustTitle}>Responsible stewardship</h2>
          </div>
          <div className={styles.copyStack}>
            <p>
              {noOrphan(
                'Because Chrism bridges procurement, coordination, and community management, the platform is built around practical security standards, including secure HTTPS, passwordless authentication, organization-based permissions, and modern email authentication practices.'
              )}
            </p>
            <p>
              {noOrphan(
                'Chrism is an Ontario-registered sole proprietorship dedicated to keeping operational capital where it matters most: directly supporting your mission.'
              )}
            </p>
          </div>
        </section>

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

        <section className={styles.ctaSection}>
          <InvoiceReviewCta />
        </section>
      </div>
    </main>
  )
}
