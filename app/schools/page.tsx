import Image from 'next/image'
import Link from 'next/link'
import BusinessMotionObserver from '@/app/marketing/business-motion-observer'
import { ChrismWorksAudienceMenu, ChrismWorksFooterLogo } from '@/app/marketing/chrism-works-audience-menu'
import styles from '../about/about.module.css'
import heroStyles from '../landing-hero.module.css'
import InvoiceReviewCta from '../invoice-review-cta'
import '../marketing/audience-card-overrides.module.css'
import '../marketing/business-motion.module.css'
import SchoolHowItWorksSection from '../school-how-it-works-section'
import schoolStyles from '../school-landing.module.css'
import './schools-mobile-fixes.module.css'
import SchoolSuppliesSection from '../school-supplies-section'

function noOrphan(text: string) {
  return text.replace(/\s+(\S+)$/, '\u00a0$1')
}

export default function SchoolsLandingPage() {
  return (
    <main className="qv-page">
      <BusinessMotionObserver />
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
        </header>

        <div className={schoolStyles.heroSupplyBridge}>
          <div className={schoolStyles.bridgeSweater} aria-hidden="true">
            <Image
              src="/st-eds_royals_sweater.png"
              alt=""
              width={880}
              height={880}
              priority
              className={schoolStyles.bridgeSweaterImage}
            />
          </div>

          <section className={`${styles.heroBlock} ${heroStyles.heroBlock} ${schoolStyles.schoolHeroBlock}`}>
            <div className={`${heroStyles.heroCopy} ${schoolStyles.schoolHeroCopy}`}>
              <h1 className={`${styles.heroTitle} ${schoolStyles.schoolHeroTitle} ${schoolStyles.animatedSchoolHeroTitle}`}>
                Everything your school needs to print, promote, and{' '}
                <span className={schoolStyles.schoolHeroAccent}>slay</span>. fr.
              </h1>
            </div>

            <div className={schoolStyles.schoolHeroLower}>
              <p className={schoolStyles.schoolHeroLead}>
                {noOrphan(
                  'Chrism is a registered Ontario business offering commercial print, custom apparel, signage, and promotional sourcing to schools and school boards at trade-level pricing.'
                )}
              </p>
            </div>
          </section>

          <div data-scroll-motion="fade">
            <SchoolSuppliesSection />
          </div>
        </div>

        <div data-scroll-motion="process">
          <SchoolHowItWorksSection />
        </div>

        <section className={`${styles.visionGrid} ${heroStyles.visionGridSix} ${schoolStyles.schoolStoryGrid}`} data-scroll-motion="fade">
          <div className={`${styles.imageColumn} ${heroStyles.visionImageColumn} ${schoolStyles.schoolStoryImageColumn}`}>
            <div className={styles.imageFrame} style={{ position: 'relative', overflow: 'hidden' }}>
              <Image
                src="/birmingham-museums-trust-aE0-ZJb2VTQ-unsplash.jpg"
                alt="Painting of a woman wearing a red beaded necklace"
                fill
                className={`${styles.aboutImage} ${schoolStyles.schoolStoryImage}`}
                sizes="(max-width: 900px) 100vw, 26vw"
              />
              <p
                className="schoolStoryImageCredit"
                style={{
                  position: 'absolute',
                  left: '12px',
                  bottom: '12px',
                  zIndex: 3,
                  display: 'inline-block',
                  width: 'fit-content',
                  maxWidth: 'calc(100% - 24px)',
                  margin: 0,
                  padding: '8px 10px',
                  borderRadius: '12px',
                  background: 'rgba(46, 42, 52, 0.62)',
                  color: '#fdfcf9',
                  fontSize: '10px',
                  lineHeight: 1.35,
                  backdropFilter: 'blur(8px)',
                }}
              >
                Photo by{' '}
                <a
                  href="https://unsplash.com/@birminghammuseumstrust?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  Birmingham Museums Trust
                </a>{' '}
                on{' '}
                <a
                  href="https://unsplash.com/photos/woman-wearing-red-beaded-necklace-painting-aE0-ZJb2VTQ?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                >
                  Unsplash
                </a>
              </p>
            </div>
          </div>

          <section className={`${styles.contentPlain} ${heroStyles.visionCopyColumn} ${schoolStyles.schoolStoryCopyColumn}`}>
            <p className={styles.eyebrow}>Why schools like us</p>
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
            </div>
          </section>

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
              <h3>
                Trade pricing.
                <br />
                Not retail markup.
              </h3>
              <p>
                {noOrphan(
                  'Because we source at wholesale and operate with low overhead, we can offer pricing that most schools aren\'t currently getting — and we\'ll show you the comparison if you want to see it.'
                )}
              </p>
            </div>
            <div className={schoolStyles.reasonItem}>
              <h3>
                A real person
                <br />
                on every order.
              </h3>
              <p>
                {noOrphan(
                  'Not a ticket system. Not a chatbot. Someone who knows your order, knows your school, and picks up the phone.'
                )}
              </p>
            </div>
          </div>
        </section>

        <div data-scroll-motion="audience-menu">
          <ChrismWorksAudienceMenu current="schools" placement="inline" />
        </div>

        <section className={`${styles.ctaSection} ${schoolStyles.schoolCtaSection}`} data-scroll-motion="fade">
          <InvoiceReviewCta variant="schoolsContact" />
        </section>

        <ChrismWorksFooterLogo />
      </div>
    </main>
  )
}
