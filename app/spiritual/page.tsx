import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { searchSpiritualContent } from '@/lib/spiritual/search'
import sharedStyles from './spiritual-section.module.css'
import styles from './spiritual.module.css'

type PageProps = {
  searchParams?: Promise<{
    q?: string
  }>
}

export default async function SpiritualLandingPage({ searchParams }: PageProps) {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const query = resolvedSearchParams.q?.trim() ?? ''
  const results = await searchSpiritualContent(query)

  const hasQuery = query.length > 0
  const hasResults =
    results.saints.length > 0 || results.prayers.length > 0 || results.catechism.length > 0

  return (
    <main className={`qv-page ${sharedStyles.page}`}>
      <div className={`qv-shell ${sharedStyles.shell} ${styles.shell}`}>
        <AppHeader brandVariant="spiritual" />

        <section className={`${sharedStyles.hero} ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <h1 className={`${sharedStyles.heroTitle} ${styles.heroTitle}`}>Spiritual Search</h1>

            <form action="/spiritual" method="get" className={styles.searchForm} role="search">
              <label htmlFor="spiritual-search-input" className={styles.searchLabel}>
                Search the spiritual companion
              </label>
              <div className={styles.searchRow}>
                <input
                  id="spiritual-search-input"
                  name="q"
                  type="search"
                  defaultValue={query}
                  className={styles.searchInput}
                  placeholder="Search prayers, saints, topics, or catechism"
                />
                <button type="submit" className={`qv-button-primary ${styles.searchButton}`}>
                  Search
                </button>
              </div>
            </form>
          </div>
        </section>

        {hasQuery ? (
          <section className={styles.resultsStack} aria-label="Spiritual search results">
            <div className={styles.resultsHeader}>
              <p className={styles.resultsEyebrow}>Results</p>
              <h2 className={styles.resultsTitle}>
                {hasResults ? `Results for "${results.query}"` : `No results for "${results.query}"`}
              </h2>
            </div>

            {results.saints.length > 0 ? (
              <section className={styles.resultSection} aria-labelledby="spiritual-results-saints">
                <div className={styles.resultSectionHeader}>
                  <h3 id="spiritual-results-saints" className={styles.resultSectionTitle}>
                    Saints
                  </h3>
                  <p className={styles.resultSectionMeta}>
                    {results.saints.length} result{results.saints.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className={styles.resultCardGrid}>
                  {results.saints.map((saint) => (
                    <article key={saint.slug} className={styles.resultCard}>
                      <div className={styles.resultCardBody}>
                        <span className={styles.resultCardTitle}>{saint.commonName ?? saint.canonicalName}</span>
                        {saint.shortBio ? <span className={styles.resultCardSummary}>{saint.shortBio}</span> : null}
                        {saint.topics.length > 0 ? (
                          <span className={styles.resultCardMeta}>
                            {saint.topics
                              .slice(0, 3)
                              .map((topic) => topic.name)
                              .join(' · ')}
                          </span>
                        ) : saint.patronSummary ? (
                          <span className={styles.resultCardMeta}>{saint.patronSummary}</span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {results.prayers.length > 0 ? (
              <section className={styles.resultSection} aria-labelledby="spiritual-results-prayers">
                <div className={styles.resultSectionHeader}>
                  <h3 id="spiritual-results-prayers" className={styles.resultSectionTitle}>
                    Prayers
                  </h3>
                  <p className={styles.resultSectionMeta}>
                    {results.prayers.length} result{results.prayers.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className={styles.resultCardGrid}>
                  {results.prayers.map((prayer) => (
                    <Link key={prayer.slug} href={`/spiritual/prayers/${prayer.slug}`} className={styles.resultCard}>
                      <div className={styles.resultCardBody}>
                        <span className={styles.resultCardTitle}>{prayer.title}</span>
                        {prayer.summary ? <span className={styles.resultCardSummary}>{prayer.summary}</span> : null}
                        {prayer.topics.length > 0 ? (
                          <span className={styles.resultCardMeta}>
                            {prayer.topics
                              .slice(0, 3)
                              .map((topic) => topic.name)
                              .join(' · ')}
                          </span>
                        ) : null}
                      </div>
                      <span className={styles.resultCardArrow} aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {results.catechism.length > 0 ? (
              <section className={styles.resultSection} aria-labelledby="spiritual-results-catechism">
                <div className={styles.resultSectionHeader}>
                  <h3 id="spiritual-results-catechism" className={styles.resultSectionTitle}>
                    Catechism
                  </h3>
                  <p className={styles.resultSectionMeta}>
                    {results.catechism.length} result{results.catechism.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className={styles.resultCardGrid}>
                  {results.catechism.map((reference) => (
                    <article key={reference.slug} className={styles.resultCard}>
                      <div className={styles.resultCardBody}>
                        <span className={styles.resultCardTitle}>{reference.title ?? reference.referenceCode}</span>
                        {reference.summary ? (
                          <span className={styles.resultCardSummary}>{reference.summary}</span>
                        ) : reference.bodyExcerpt ? (
                          <span className={styles.resultCardSummary}>{reference.bodyExcerpt}</span>
                        ) : null}
                        <span className={styles.resultCardMeta}>{reference.referenceCode}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {!hasResults ? (
              <section className={styles.emptyState} aria-live="polite">
                <h3 className={styles.emptyStateTitle}>Nothing matched yet.</h3>
                <p className={styles.emptyStateCopy}>
                  Try a prayer title, saint name, or topic like Joseph, protection, fatherhood, or discernment.
                </p>
              </section>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  )
}
