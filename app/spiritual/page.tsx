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
            <h1 className={styles.heroTitle}>Spiritual Search</h1>

            <form className={styles.searchShell} role="search">
              <label htmlFor="spiritual-search-input" className={styles.searchLabel}>
                Search
              </label>
              <div className={styles.searchRow}>
                <input
                  id="spiritual-search-input"
                  type="search"
                  className={styles.searchInput}
                  placeholder="Search prayers, saints, topics, or catechism"
                />
                <button type="button" className={styles.searchButton} disabled>
                  Search
                </button>
              </div>
            </form>

            {showOperationsLink ? (
              <div className={styles.heroActions}>
                <Link href="/" className={styles.secondaryAction}>
                  Back to Operations
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.libraryGrid} aria-label="Spiritual search sections">
          <article className={styles.featureCard}>
            <div className={styles.featureHeader}>
              <div>
                <p className={styles.featureEyebrow}>Prayer</p>
                <h2 className={styles.featureTitle}>Prayers</h2>
              </div>
              <span className={styles.featureBadge}>Live</span>
            </div>
            <p className={styles.featureBody}>
              Browse traditional prayers, litanies, devotions, blessings, and short prayers for everyday moments.
            </p>
            <Link href="/spiritual/prayers" className={styles.inlineLink}>
              Open prayers
            </Link>
          </article>

          <article className={styles.featureCard}>
            <div className={styles.featureHeader}>
              <div>
                <p className={styles.featureEyebrow}>Readings</p>
                <h2 className={styles.featureTitle}>Daily Readings</h2>
              </div>
              <span className={styles.featureBadgeMuted}>Soon</span>
            </div>
            <p className={styles.featureBody}>
              A daily place for scripture, quiet reflection, and companion content tied to the liturgical day.
            </p>
          </article>
        </section>
      </div>
    </main>
  )
}
