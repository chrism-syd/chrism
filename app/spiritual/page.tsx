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
    saint?: string
    topic?: string
  }>
}

export default async function SpiritualLandingPage({ searchParams }: PageProps) {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const query = resolvedSearchParams.q?.trim() ?? ''
  const saintPivot = resolvedSearchParams.saint?.trim() ?? ''
  const topicPivot = resolvedSearchParams.topic?.trim() ?? ''

  const results = await searchSpiritualContent({
    query,
    saintSlug: saintPivot || undefined,
    topicSlug: topicPivot || undefined,
  })

  const hasQuery = query.length > 0 || saintPivot.length > 0 || topicPivot.length > 0
  const hasResults = Boolean(results.startHere)

  return (
    <main className={`qv-page ${sharedStyles.page}`}>
      <div className={`qv-shell ${sharedStyles.shell} ${styles.shell}`}>
        <AppHeader brandVariant="spiritual" />

        <section className={`${sharedStyles.hero} ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <h1 className={`${sharedStyles.heroTitle} ${styles.heroTitle}`}>Spiritual Search</h1>

            <form action="/spiritual" method="get" className={styles.searchForm} role="search">
              <label htmlFor="spiritual-search-input" className={styles.searchLabel}>
                Search prayers, saints, themes, or catechism
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
          <section className={styles.pathwayStack} aria-label="Spiritual search pathway">
            <div className={styles.pathwayHeader}>
              <p className={styles.pathwayEyebrow}>Pathway</p>
              <h2 className={styles.pathwayTitle}>
                {hasResults ? results.interpretationLabel : `Nothing matched clearly for "${results.query}"`}
              </h2>
              {results.activePivotLabel ? <p className={styles.pathwayCopy}>{results.activePivotLabel}</p> : null}
            </div>

            {results.startHere ? (
              <section className={styles.startHereCard} aria-labelledby="start-here-title">
                <div className={styles.startHereHeader}>
                  <p className={styles.sectionEyebrow}>Start here</p>
                  <h3 id="start-here-title" className={styles.startHereTitle}>
                    {results.startHere.title}
                  </h3>
                  <p className={styles.startHereCopy}>{results.startHere.description}</p>
                </div>

                <div className={styles.startHereGrid}>
                  {results.startHere.featuredPrayer ? (
                    <Link
                      href={`/spiritual/prayers/${results.startHere.featuredPrayer.slug}`}
                      className={styles.startHerePanel}
                    >
                      <p className={styles.panelLabel}>Begin with prayer</p>
                      <span className={styles.panelTitle}>{results.startHere.featuredPrayer.title}</span>
                      {results.startHere.featuredPrayer.summary ? (
                        <span className={styles.panelCopy}>{results.startHere.featuredPrayer.summary}</span>
                      ) : null}
                      <span className={styles.panelAction}>Open prayer →</span>
                    </Link>
                  ) : null}

                  {results.startHere.featuredSaint ? (
                    <article className={styles.startHerePanel}>
                      <p className={styles.panelLabel}>Walk with this saint</p>
                      <span className={styles.panelTitle}>
                        {results.startHere.featuredSaint.commonName ?? results.startHere.featuredSaint.canonicalName}
                      </span>
                      {results.startHere.featuredSaint.shortBio ? (
                        <span className={styles.panelCopy}>{results.startHere.featuredSaint.shortBio}</span>
                      ) : null}
                      <button type="button" className={styles.panelSaveButton}>
                        Add to My Devotions
                      </button>
                    </article>
                  ) : null}

                  {results.startHere.featuredCatechism ? (
                    <article className={styles.startHerePanel}>
                      <p className={styles.panelLabel}>Ground this in the faith</p>
                      <span className={styles.panelTitle}>
                        {results.startHere.featuredCatechism.title ?? results.startHere.featuredCatechism.referenceCode}
                      </span>
                      {results.startHere.featuredCatechism.summary ? (
                        <span className={styles.panelCopy}>{results.startHere.featuredCatechism.summary}</span>
                      ) : results.startHere.featuredCatechism.bodyExcerpt ? (
                        <span className={styles.panelCopy}>{results.startHere.featuredCatechism.bodyExcerpt}</span>
                      ) : null}
                      <span className={styles.panelMeta}>{results.startHere.featuredCatechism.referenceCode}</span>
                    </article>
                  ) : null}
                </div>

                {results.startHere.relatedThemes.length > 0 ? (
                  <div className={styles.explorationRail}>
                    {results.startHere.relatedThemes.map((theme) => (
                      <Link
                        key={theme.slug}
                        href={`/spiritual?q=${encodeURIComponent(theme.name)}&topic=${encodeURIComponent(theme.slug)}`}
                        className={styles.themeChip}
                      >
                        {theme.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {results.pivots.length > 0 ? (
              <section className={styles.pivotCard} aria-labelledby="pivot-title">
                <div className={styles.pivotHeader}>
                  <h3 id="pivot-title" className={styles.pivotTitle}>
                    {results.pivotHeading}
                  </h3>
                  {results.pivotCopy ? <p className={styles.pivotCopy}>{results.pivotCopy}</p> : null}
                </div>

                <div className={styles.pivotGrid}>
                  {results.pivots.map((pivot) => (
                    <Link
                      key={`${pivot.kind}-${pivot.slug}`}
                      href={`/spiritual?q=${encodeURIComponent(results.query || pivot.title)}&saint=${encodeURIComponent(
                        pivot.slug
                      )}`}
                      className={styles.pivotItem}
                    >
                      <span className={styles.pivotItemTitle}>{pivot.title}</span>
                      {pivot.subtitle ? <span className={styles.pivotItemCopy}>{pivot.subtitle}</span> : null}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {results.prayers.length > 0 ? (
              <section className={styles.resultSection} aria-labelledby="spiritual-results-prayers">
                <div className={styles.resultSectionHeader}>
                  <h3 id="spiritual-results-prayers" className={styles.resultSectionTitle}>
                    Begin with prayer
                  </h3>
                  <p className={styles.resultSectionMeta}>
                    {results.prayers.length} suggestion{results.prayers.length === 1 ? '' : 's'}
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

            {results.saints.length > 0 ? (
              <section className={styles.resultSection} aria-labelledby="spiritual-results-saints">
                <div className={styles.resultSectionHeader}>
                  <h3 id="spiritual-results-saints" className={styles.resultSectionTitle}>
                    Walk with this saint
                  </h3>
                  <p className={styles.resultSectionMeta}>
                    {results.saints.length} companion{results.saints.length === 1 ? '' : 's'}
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
                      <button type="button" className={styles.cardSaveButton}>
                        Add to My Devotions
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {results.catechism.length > 0 ? (
              <section className={styles.resultSection} aria-labelledby="spiritual-results-catechism">
                <div className={styles.resultSectionHeader}>
                  <h3 id="spiritual-results-catechism" className={styles.resultSectionTitle}>
                    Ground this in the faith
                  </h3>
                  <p className={styles.resultSectionMeta}>
                    {results.catechism.length} reference{results.catechism.length === 1 ? '' : 's'}
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

            {results.relatedThemes.length > 0 ? (
              <section className={styles.resultSection} aria-labelledby="spiritual-results-explore">
                <div className={styles.resultSectionHeader}>
                  <h3 id="spiritual-results-explore" className={styles.resultSectionTitle}>
                    Keep exploring
                  </h3>
                </div>

                <div className={styles.explorationRail}>
                  {results.relatedThemes.map((theme) => (
                    <Link
                      key={theme.slug}
                      href={`/spiritual?q=${encodeURIComponent(theme.name)}&topic=${encodeURIComponent(theme.slug)}`}
                      className={styles.themeChip}
                    >
                      {theme.name}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {!hasResults ? (
              <section className={styles.emptyState} aria-live="polite">
                <h3 className={styles.emptyStateTitle}>Nothing matched clearly yet.</h3>
                <p className={styles.emptyStateCopy}>
                  Try another doorway into the same need, or begin with a topic like Joseph, protection,
                  fatherhood, or discernment.
                </p>
              </section>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  )
}