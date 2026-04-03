import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import sharedStyles from './spiritual-section.module.css'
import styles from './spiritual.module.css'

export default async function SpiritualLandingPage() {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  return (
    <main className={`qv-page ${sharedStyles.page}`}>
      <div className={`qv-shell ${sharedStyles.shell} ${styles.shell}`}>
        <AppHeader brandVariant="spiritual" />

        <section className={`${sharedStyles.hero} ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <h1 className={`${sharedStyles.heroTitle} ${styles.heroTitle}`}>Spiritual landing.</h1>
            <p className={`${sharedStyles.heroSubtitle} ${styles.heroSubtitle}`}>
              A calmer place for prayer, daily readings, and the spiritual companion side of Chrism.
            </p>
          </div>
        </section>

        <section className={styles.cardGrid} aria-label="Spiritual guidance shortcuts">
          <article className={styles.areaCard}>
            <div className={styles.cardInner}>
              <h2 className={styles.cardTitle}>Prayers</h2>
              <p className={styles.cardIntro}>
                Keep the prayers you return to most close at hand, and give members a place to explore
                prayers rooted in the life of the Church.
              </p>

              <div className={styles.cardSection}>
                <p className={styles.cardSectionTitle}>
                  Browse a prayer library, devotional entries, and future organization-specific prayers.
                </p>
                <Link href="/spiritual/prayers" className={`qv-button-secondary ${styles.cardButton}`}>
                  Prayer library
                </Link>
              </div>
            </div>
            <div className={styles.cardBanner} aria-hidden="true" />
          </article>

          <article className={styles.areaCard}>
            <div className={styles.cardInner}>
              <h2 className={styles.cardTitle}>Daily Readings</h2>
              <p className={styles.cardIntro}>
                Give members a simple rhythm for scripture, reflection, and returning to the app each day.
              </p>

              <div className={styles.cardSection}>
                <p className={styles.cardSectionTitle}>
                  Surface today&apos;s reading, a short reflection, and the first entry point into daily spiritual guidance.
                </p>
                <button type="button" className={`qv-button-secondary ${styles.cardButton}`} disabled>
                  Today&apos;s reading
                </button>
              </div>
            </div>
            <div className={styles.cardBanner} aria-hidden="true" />
          </article>
        </section>
      </div>
    </main>
  )
}
