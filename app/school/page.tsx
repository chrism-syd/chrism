import Image from 'next/image'
import Link from 'next/link'
import styles from '../about/about.module.css'
import faqStyles from '../faq-image.module.css'
import heroStyles from '../landing-hero.module.css'
import InvoiceReviewCta from '../invoice-review-cta'
import SchoolHowItWorksSection from '../school-how-it-works-section'
import schoolStyles from '../school-landing.module.css'
import SchoolSuppliesSection from '../school-supplies-section'

function noOrphan(text: string) {
  return text.replace(/\s+(\S+)$/, '\u00a0$1')
}

const faqs = [
  {
    question: 'What kind of print work can Chrism source?',
    answer:
      'Chrism can help source flyers, brochures, booklets, posters, newsletters, presentation folders, forms, certificates, signs, banners, apparel, promotional products, and other school print needs.',
  },
  {
    question: 'Can Chrism work with school boards or procurement procedures?',
    answer:
      'Yes. Chrism can work within existing institutional procurement procedures, including purchase orders and formal payment terms.',
  },
  {
    question: 'How quickly can we get a quote?',
    answer:
      'Most quotes are turned around within one business day, depending on the complexity of the request and whether files or specifications are ready.',
  },
  {
    question: 'Can you compare against an existing invoice?',
    answer:
      'Yes. Send the invoice or project details and Chrism can tell you whether there is a meaningful savings opportunity.',
  },
  {
    question: 'Do you only work with schools?',
    answer:
      'No. Chrism also supports school boards, parent councils, faith communities, nonprofits, and local organizations with practical sourcing and production support.',
  },
]

export default function SchoolLandingPage() {
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

          <Link href="https://operations.chrism.app" className={`qv-button-secondary qv-link-button ${styles.signInButton}`}>
            Launch Operations
          </Link>
        </header>

        <section className={`${styles.heroBlock} ${heroStyles.heroBlock} ${schoolStyles.schoolHeroBlock}`}>
          <div className={`${heroStyles.heroCopy} ${schoolStyles.schoolHeroCopy}`}>
            <h1 className={`${styles.heroTitle} ${schoolStyles.schoolHeroTitle}`}>
              Everything your school needs to print, promote, and show up well.
            </h1>
          </div>

          <div className={schoolStyles.schoolHeroLower}>
            <p className={schoolStyles.schoolHeroLead}>
              {noOrphan(
                'Chrism is a registered Ontario business offering commercial print, custom apparel, signage, and promotional sourcing to schools and school boards at trade-level pricing.'
              )}
            </p>

            <div className={`${heroStyles.heroArtwork} ${schoolStyles.schoolHeroArtwork}`} aria-hidden="true">
              <Image
                src="/chair_school.png"
                alt=""
                width={780}
                height={780}
                priority
                className={heroStyles.heroChairImage}
              />
            </div>
          </div>
        </section>

        <SchoolSuppliesSection />

        <SchoolHowItWorksSection />

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
              <p className={faqStyles.faqImageCredit}>
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
          </div>

          <section className={`${styles.contentPlain} ${heroStyles.visionCopyColumn}`}>
            <p className={styles.eyebrow}>Why schools work with us</p>
            <h2 className={`${styles.sectionTitle} ${heroStyles.visionTitle}`}>
              We know what things cost{' '}
              <span className={heroStyles.noWrap}>
                and what they <span className={heroStyles.accentWord}>should cost.</span>
              </span>
            </h2>
            <div className={styles.copyStack}>
              <p>
                {noOrphan(
                  'We\'ve sat in the parent council meetings. We know what things cost — and what they should cost.'
                )}
              </p>
              <p>
                {noOrphan(
                  'Chrism was built by someone embedded in the school community, not looking at it from the outside. That means we understand the difference between a grad keepsake that feels worthy of the moment and one that feels like it came from a dollar store. We know that spirit day banners need to arrive before spirit day. And we know that parent councils are often doing this work on evenings and weekends with whatever budget is left over.'
                )}
              </p>
              <p>
                {noOrphan(
                  'That\'s why we run lean, keep our margins low, and stay flexible. Not as a favour — because it\'s the model.'
                )}
              </p>
              <div className={schoolStyles.reasonList}>
                <div className={schoolStyles.reasonItem}>
                  <h3>One vendor. Everything your school needs.</h3>
                  <p>
                    {noOrphan(
                      'Print, signage, apparel, and promotional products — sourced and managed in one place. No coordinating between suppliers. No explaining your needs three times to three different reps.'
                    )}
                  </p>
                </div>
                <div className={schoolStyles.reasonItem}>
                  <h3>Trade pricing. Not retail markup.</h3>
                  <p>
                    {noOrphan(
                      'Because we source at wholesale and operate with low overhead, we can offer pricing that most schools aren\'t currently getting — and we\'ll show you the comparison if you want to see it.'
                    )}
                  </p>
                </div>
                <div className={schoolStyles.reasonItem}>
                  <h3>A real person on every order.</h3>
                  <p>
                    {noOrphan(
                      'Not a ticket system. Not a chatbot. Someone who knows your order, knows your school, and picks up the phone.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className={`${styles.faqSection} ${faqStyles.faqWithImage}`}>
          <div className={faqStyles.faqContent}>
            <div className={styles.sectionIntroWide}>
              <h2 className={`${styles.sectionTitle} ${heroStyles.visionTitle}`}>{noOrphan('Common questions')}</h2>
            </div>

            <div className={styles.faqList}>
              {faqs.map((faq) => (
                <details key={faq.question} className={styles.faqItem}>
                  <summary>{faq.question}</summary>
                  <p>{noOrphan(faq.answer)}</p>
                </details>
              ))}
            </div>
          </div>

          <div className={faqStyles.faqImageColumn}>
            <div className={faqStyles.faqImageFrame}>
              <Image
                src="/elvira-blumfelde-XzI0bYWdhbY-unsplash.jpg"
                alt="Person leaning on a white concrete fence"
                fill
                className={faqStyles.faqImage}
                sizes="(max-width: 900px) 100vw, 24vw"
              />
              <p className={faqStyles.faqImageCredit}>
                Photo by{' '}
                <a
                  href="https://unsplash.com/@perlamutrs?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                  target="_blank"
                  rel="noreferrer"
                >
                  Elvira Blumfelde
                </a>{' '}
                on{' '}
                <a
                  href="https://unsplash.com/photos/person-leaning-on-white-concrete-fence-XzI0bYWdhbY?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                  target="_blank"
                  rel="noreferrer"
                >
                  Unsplash
                </a>
              </p>
            </div>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <InvoiceReviewCta />
        </section>
      </div>
    </main>
  )
}
