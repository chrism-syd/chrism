import { notFound } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/app/app-header'
import { getPrayerBySlug, listPublishedPrayers } from '@/lib/spiritual/prayers'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import styles from './prayer-detail.module.css'

type PageProps = {
  params: Promise<{ slug: string }>
}

function sectionTitleForType(type: string | null) {
  switch (type) {
    case 'litany':
      return 'Litany'
    case 'novena':
      return 'Novena'
    case 'chaplet':
      return 'Chaplet'
    case 'blessing':
      return 'Blessing'
    case 'collect':
      return 'Collect'
    case 'intercession':
      return 'Intercession'
    case 'devotion':
      return 'Devotion'
    case 'other':
      return 'Prayer'
    default:
      return 'Traditional prayer'
  }
}

function renderPrayerBody(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => <p key={index}>{paragraph}</p>)
}

export async function generateStaticParams() {
  const prayers = await listPublishedPrayers()
  return prayers.map((prayer) => ({ slug: prayer.slug }))
}

export default async function PrayerDetailPage({ params }: PageProps) {
  const { slug } = await params
  const [permissions, prayer] = await Promise.all([
    getCurrentUserPermissions(),
    getPrayerBySlug(slug),
  ])

  if (!prayer) {
    notFound()
  }

  const showOperationsLink = permissions.isSignedIn && permissions.hasStaffAccess
  const typeTitle = sectionTitleForType(prayer.prayerTypeCode)

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <AppHeader />

        <section className={styles.heroCard}>
          <p className={styles.eyebrow}>{typeTitle}</p>
          <h1 className={styles.heroTitle}>{prayer.title}</h1>
          {prayer.summary ? <p className={styles.heroBody}>{prayer.summary}</p> : null}
          <div className={styles.heroActions}>
            <Link href="/spiritual/prayers" className={styles.secondaryAction}>
              Back to Prayer Library
            </Link>
            {showOperationsLink ? (
              <Link href="/" className={styles.secondaryAction}>
                Back to Operations
              </Link>
            ) : null}
          </div>
        </section>

        <article className={styles.contentCard}>
          <div className={styles.metaRow}>
            <span className={styles.metaPill}>{typeTitle}</span>
            {prayer.statusCode ? <span className={styles.metaPillMuted}>{prayer.statusCode}</span> : null}
          </div>
          <div className={styles.prayerBody}>{renderPrayerBody(prayer.body)}</div>
        </article>
      </div>
    </main>
  )
}
