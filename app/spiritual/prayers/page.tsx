import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { listPublishedPrayers } from '@/lib/spiritual/prayers'
import PrayerLibraryClient from './prayer-library-client'
import sharedStyles from '../spiritual-section.module.css'
import styles from './prayer-library.module.css'

export const metadata: Metadata = {
  title: 'Prayer Library | Chrism',
}

export default async function PrayerLibraryPage() {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const prayers = await listPublishedPrayers()

  return (
    <main className={`qv-page ${sharedStyles.page}`}>
      <div className={`qv-shell ${sharedStyles.shell} ${styles.shell}`}>
        <AppHeader brandVariant="spiritual" />

        <section className={`${sharedStyles.hero} ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <h1 className={`${sharedStyles.heroTitle} ${styles.heroTitle}`}>Prayers</h1>
          </div>
        </section>

        <PrayerLibraryClient prayers={prayers} />
      </div>
    </main>
  )
}
