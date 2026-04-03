import Link from 'next/link'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import styles from './spiritual-section.module.css'

export default async function SpiritualCompanionPage() {
  const permissions = await getCurrentUserPermissions()
  const showOperationsLink = permissions.isSignedIn && permissions.hasStaffAccess

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <AppHeader />

        <section className={styles.heroCard}>
          <div className={styles.heroIntro}>
            <p className={styles.eyebrow}>Spiritual companion</p>
            <h1 className={styles.heroTitle}>A quiet place to pray, reflect, and keep holy company.</h1>
            <p className={styles.heroBody}>
              Explore the prayer library, daily readings, saint reflections, and saved devotions built for the rhythms of Catholic life.
            </p>
            <div className={styles.heroActions}>
              <Link href="/spiritual/prayers" className={styles.primaryAction}>
                Prayer library
              </Link>
              {showOperationsLink ? (
                <Link href="/" className={styles.secondaryAction}>
                  Back to Operations
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className={styles.libraryGrid} aria-label="Spiritual companion library sections">
          <article className={styles.featureCard}>
            <div className={styles.featureHeader}>
              <div>
                <p className={styles.featureEyebrow}>Prayer</p>
                <h2 className={styles.featureTitle}>Prayer library</h2>
              </div>
              <span className={styles.featureBadge}>Live</span>
            </div>
            <p className={styles.featureBody}>
              Browse traditional prayers, litanies, devotions, blessings, and short prayers for everyday moments.
            </p>
            <Link href="/spiritual/prayers" className={styles.inlineLink}>
              Open prayer library
            </Link>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureHeader}>
              <div>
                <p className={styles.featureEyebrow}>Readings</p>
                <h2 className={styles.featureTitle}>Daily readings</h2>
              </div>
              <span className={styles.featureBadgeMuted}>Soon</span>
            </div>
            <p className={styles.featureBody}>
              A daily place for scripture, quiet reflection, and companion content tied to the liturgical day.
            </p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureHeader}>
              <div>
                <p className={styles.featureEyebrow}>Saints</p>
                <h2 className={styles.featureTitle}>Saint companion</h2>
              </div>
              <span className={styles.featureBadgeMuted}>Soon</span>
            </div>
            <p className={styles.featureBody}>
              Discover saints by story, patronage, and lived witness, with reflections that speak to your real life.
            </p>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureHeader}>
              <div>
                <p className={styles.featureEyebrow}>Saved</p>
                <h2 className={styles.featureTitle}>My devotions</h2>
              </div>
              <span className={styles.featureBadgeMuted}>Soon</span>
            </div>
            <p className={styles.featureBody}>
              Keep the prayers, readings, and reflections you return to most often in one peaceful place.
            </p>
          </article>
        </section>
      </div>
    </main>
  )
}
