import type { Metadata } from 'next'
import Link from 'next/link'
import { Fragment } from 'react'
import { notFound, redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { formatAuthorityLabel, getPrayerBySlug } from '@/lib/spiritual/prayers'
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
    title: prayer ? `${prayer.title} | Prayer Library | Chrism` : 'Prayer | Chrism',
  }
}

export default async function PrayerDetailPage({ params }: PageProps) {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const { slug } = await params
  const prayer = await getPrayerBySlug(slug)

  if (!prayer) {
    notFound()
  }

  const authorityLabel = formatAuthorityLabel(prayer.authorityLevel)
  const authoritySourceLabel = prayer.sourceLabel ?? authorityLabel
  const prayerText = prayer.bodyMarkdown?.trim() ?? ''
  const showLanguage = prayer.languageCode && prayer.languageCode.toLowerCase() !== 'en'

  return (
    <main className={`qv-page ${sharedStyles.page}`}>
      <div className={`qv-shell ${sharedStyles.shell} ${styles.shell}`}>
        <AppHeader brandVariant="spiritual" />

        <section className={`${sharedStyles.hero} ${styles.hero}`}>
          <div className={styles.heroTopRow}>
            <Link href="/spiritual/prayers" className={sharedStyles.backLink}>
              ← Back to Prayer Library
            </Link>
          </div>

          <div className={styles.heroCopy}>
            <p className={sharedStyles.eyebrow}>Prayer Library</p>
            <h1 className={`${sharedStyles.heroTitle} ${styles.heroTitle}`}>{prayer.title}</h1>

            <div className={styles.metaLine}>
              <span>{prayer.prayerTypeLabel}</span>
              {showLanguage ? (
                <>
                  <span className={styles.metaDot} aria-hidden="true">
                    •
                  </span>
                  <span>{prayer.languageCode?.toUpperCase()}</span>
                </>
              ) : null}
            </div>

            {prayer.summary ? <p className={`${sharedStyles.heroSubtitle} ${styles.heroSubtitle}`}>{prayer.summary}</p> : null}
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
                      <dt>Authority</dt>
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
                      <dt>About</dt>
                      <dd>{prayer.summary}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  )
}
