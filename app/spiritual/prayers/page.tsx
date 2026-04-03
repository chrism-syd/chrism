import AppHeader from '@/app/app-header'
import { listPublishedPrayers } from '@/lib/spiritual/prayers'
import PrayerLibraryClient from './prayer-library-client'
import styles from './prayer-library.module.css'

export default async function PrayerLibraryPage() {
  const prayers = await listPublishedPrayers()

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <AppHeader />
        <section className={styles.heroCard}>
          <p className={styles.eyebrow}>Prayer Library</p>
          <h1 className={styles.heroTitle}>A growing collection of Catholic prayers for ordinary days and holy seasons.</h1>
          <p className={styles.heroBody}>
            Browse traditional prayers, blessings, devotions, litanies, and short prayers of intercession drawn from the spiritual companion library.
          </p>
        </section>
        <PrayerLibraryClient prayers={prayers} />
      </div>
    </main>
  )
}
