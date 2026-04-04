import type { Metadata } from 'next'
import Link from 'next/link'
import { Fragment } from 'react'
import { notFound, redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { formatAuthorityLabel, getPrayerBySlug, listPublishedPrayers } from '@/lib/spiritual/prayers'
import sharedStyles from '../../spiritual-section.module.css'
import styles from './prayer-detail.module.css'

type PageProps = {
  params: Promise<{
    slug: string
  }>
}

function renderPrayerText(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, paragraphIndex) => {
      const lines = paragraph.split('\n')
      return (
        <p key={`paragraph-${paragraphIndex}`} className={styles.prayerParagraph}>
          {lines.map((line, lineIndex) => (
            <Fragment key={`line-${paragraphIndex}-${lineIndex}`}>
              {line}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      )
    })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const prayer = await getPrayerBySlug(slug)

  return {
    title: prayer ? `${prayer.title} | Spiritual Search | Chrism` : 'Prayer | Chrism',
  }
}

export default async function PrayerDetailPage({ params }: PageProps) {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const { slug } = await params
  const [prayer, allPrayers] = await Promise.all([
    getPrayerBySlug(slug),
    listPublishedPrayers(),
  ])

  if (!prayer) {
    notFound()
  }

  const authorityLabel = formatAuthorityLabel(prayer.authorityLevel)
  const authoritySourceLabel = prayer.sourceLabel ?? authorityLabel
  const prayerText = prayer.bodyMarkdown?.trim() ?? ''
  const relatedLibraryPrayers = allPrayers.filter((entry) => entry.slug !== prayer.slug).slice(0, 6)

  return (
    <main className={`qv-page ${sharedStyles.page}`}>
      <div className={`qv-shell ${sharedStyles.shell} ${styles.shell}`}>
        <AppHeader brandVariant="spiritual" />

        <section className={`${sharedStyles.hero} ${styles.hero}`}>
          <div className={styles.heroTopRow}>
            <Link href="/spiritual" className={sharedStyles.backLink}>
              ← Back
            </Link>
            <p className={sharedStyles.eyebrow}>Spiritual Search</p>
          </div>

          <div className={styles.heroCopy}>
            <h1 className={`${sharedStyles.heroTitle} ${styles.heroTitle}`}>{prayer.title}</h1>
          </div>
        </section>

        <div className={styles.layout}>
          <article className={styles.prayerColumn}>
            {prayerText ? (
              <div className={styles.prayerBody}>{renderPrayerText(prayerText)}</div>
            ) : (
              <p className={styles.placeholderCopy}>
                This prayer has a title and metadata seeded already, but the body text still needs to be added.
              </p>
            )}
          </article>

          {(authoritySourceLabel || prayer.summary) ? (
            <aside className={styles.metaColumn}>
              <section className={styles.metaCard}>
                <dl className={styles.metaList}>
                  {authoritySourceLabel ? (
                    <div>
                      <dt>Source</dt>
                      <dd>
                        {prayer.sourceUrl ? (
                          <a href={prayer.sourceUrl} className={styles.sourceLink} target="_blank" rel="noreferrer">
                            {authoritySourceLabel}
                          </a>
                        ) : (
                          authoritySourceLabel
                        )}
                      </dd>
                    </div>
                  ) : null}

                  {prayer.summary ? (
                    <div>
                      <dt>About this prayer</dt>
                      <dd>{prayer.summary}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            </aside>
          ) : null}
        </div>

        <section className={styles.bottomSections} aria-label="More spiritual browsing">
          <article className={styles.bottomCard}>
            <div className={styles.bottomCardHeader}>
              <div>
                <p className={styles.bottomEyebrow}>Prayers</p>
                <h2 className={styles.bottomTitle}>Prayer library</h2>
              </div>
              <Link href="/spiritual/prayers" className={styles.bottomAction}>
                Open library
              </Link>
            </div>

            {relatedLibraryPrayers.length > 0 ? (
              <div className={styles.bottomList}>
                {relatedLibraryPrayers.map((entry) => (
                  <Link key={entry.slug} href={`/spiritual/prayers/${entry.slug}`} className={styles.bottomListItem}>
                    <span className={styles.bottomListTitle}>{entry.title}</span>
                    <span className={styles.bottomListArrow} aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.bottomEmptyCopy}>More prayer entries will appear here as the library grows.</p>
            )}
          </article>

          <article className={styles.bottomCard}>
            <div className={styles.bottomCardHeader}>
              <div>
                <p className={styles.bottomEyebrow}>Daily Readings</p>
                <h2 className={styles.bottomTitle}>Today&apos;s reading</h2>
              </div>
            </div>

            <p className={styles.bottomBody}>
              Daily readings are planned for this surface next, so members can move from a prayer into scripture and reflection without bouncing around the app.
            </p>

            <button type="button" className={styles.disabledButton} disabled>
              Daily readings coming soon
            </button>
          </article>
        </section>
      </div>
    </main>
  )
}
