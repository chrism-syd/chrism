import Image from 'next/image'
import Link from 'next/link'
import styles from './about.module.css'

export default function AboutPage() {
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

          <Link href="/login" className={`qv-button-secondary qv-link-button ${styles.signInButton}`}>
            Sign in
          </Link>
        </header>

        <section className={styles.heroBlock}>
          <h1 className={styles.heroTitle}>
            A formation platform
            <br />
            with ministry, fellowship,
            <br />
            and faith at its core.
          </h1>

          <div className={styles.heroCopy}>
            <p className={styles.heroLead}>
              <strong>Ministries run on care:</strong> volunteers who show up, leaders who remember names,
              and members who stay connected across seasons of life.
            </p>
            <p className={styles.heroBody}>
              What they rarely have is a simple, affordable tool built to support that work. Enterprise
              CRM software wasn&apos;t designed for parish life. Spreadsheets don&apos;t scale. And the
              people doing this work deserve better than cobbled-together workarounds.
            </p>
          </div>
        </section>

        <section className={styles.pillarsSection}>
          <div className={styles.imageColumn}>
            <div className={styles.imageFrame}>
              <Image
                src="/jonny-gios-QMesAlxmi6g-unsplash.jpg"
                alt="Large mural text reading you and me"
                fill
                className={styles.aboutImage}
                sizes="(max-width: 900px) 100vw, 42vw"
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

          <div className={styles.pillarsColumn}>
            <p className={styles.pillarsIntro}>
              <strong>Chrism is built around pillars that sit at the heart of Catholic ministry life:</strong>
            </p>

            <div className={styles.pillarStack}>
              <section className={styles.pillar}>
                <h2 className={styles.pillarTitle}>Community</h2>
                <p>
                  Chrism gives organizations a practical way to manage members, organize events,
                  coordinate volunteers, and stay connected to the people who make ministry work,
                  including those who are active, those who are less able to participate, and those
                  who have drifted away.
                </p>
              </section>

              <section className={styles.pillar}>
                <h2 className={styles.pillarTitle}>Faith</h2>
                <p>
                  Chrism is being built to grow into a spiritual companion: a place for prayer,
                  devotion, and guided faith content that can serve both members and the broader
                  parish community.
                </p>
              </section>

              <section className={styles.pillar}>
                <h2 className={styles.pillarTitle}>Service</h2>
                <p>
                  Chrism supports the charitable work that defines Catholic life: coordinating
                  volunteers, tracking outreach efforts, and mobilizing members to serve their neighbors.
                </p>
              </section>
            </div>
          </div>
        </section>

        <section className={styles.freeBand}>
          <div>
            <h2 className={styles.freeBandTitle}>
              Chrism&apos;s core
              <br />
              functionality will
              <br />
              always be FREE.
            </h2>
          </div>

          <div className={styles.freeBandCopy}>
            <p>
              The essential tools of member engagement and care should be accessible to every ministry,
              not just the ones with a budget.
            </p>
            <p>
              Spiritual practice through daily prayer and devotions shouldn&apos;t start with a paywall.
            </p>
          </div>
        </section>

        <section className={styles.bottomGrid}>
          <section className={styles.bottomColumn}>
            <h2 className={styles.bottomTitle}>
              Stronger pathways
              <br />
              into parish life
            </h2>
            <p className={styles.bottomLead}>
              <strong>
                Helping ministries welcome new people, reconnect with inactive members, and build
                stronger pathways into parish life.
              </strong>
            </p>
            <ul className={styles.bulletList}>
              <li>Member directories and records</li>
              <li>Event calendars, RSVP and volunteer coordination</li>
              <li>Outreach and follow-up through custom shareable lists</li>
            </ul>
          </section>

          <section className={styles.bottomColumn}>
            <h2 className={styles.bottomTitle}>
              Deeper connection
              <br />
              with faith
            </h2>
            <p className={styles.bottomLead}>
              <strong>
                A spiritual companion that helps members build a daily rhythm of prayer and devotion.
              </strong>
            </p>
            <ul className={styles.bulletList}>
              <li>Daily scripture and reflections</li>
              <li>Guided Rosary with meditations</li>
              <li>Spiritual guidance</li>
              <li>Personal prayer book and prayer intentions</li>
            </ul>
          </section>
        </section>
      </div>
    </main>
  )
}
