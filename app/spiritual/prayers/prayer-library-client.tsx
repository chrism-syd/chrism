'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { PrayerListItem } from '@/lib/spiritual/prayers'
import styles from './prayer-library.module.css'

type Props = {
  prayers: PrayerListItem[]
}

function groupKey(prayer: PrayerListItem) {
  return prayer.prayerType ?? 'other'
}

export default function PrayerLibraryClient({ prayers }: Props) {
  const [query, setQuery] = useState('')
  const [prayerType, setPrayerType] = useState<'all' | string>('all')
  const [isLibraryOpen, setLibraryOpen] = useState(false)

  const prayerTypes = useMemo(
    () =>
      Array.from(
        new Map(
          prayers.map((prayer) => [groupKey(prayer), { value: groupKey(prayer), label: prayer.prayerTypeLabel }])
        ).values()
      ),
    [prayers]
  )

  const normalizedQuery = query.trim().toLowerCase()

  const filteredPrayers = useMemo(() => {
    return prayers.filter((prayer) => {
      const matchesType = prayerType === 'all' || groupKey(prayer) === prayerType
      const matchesQuery = normalizedQuery.length === 0 || prayer.title.toLowerCase().includes(normalizedQuery)
      return matchesType && matchesQuery
    })
  }, [normalizedQuery, prayerType, prayers])

  const groupedPrayers = useMemo(() => {
    const grouped = new Map<string, { label: string; prayers: PrayerListItem[] }>()

    for (const prayer of filteredPrayers) {
      const key = groupKey(prayer)
      const current: { label: string; prayers: PrayerListItem[] } =
        grouped.get(key) ?? { label: prayer.prayerTypeLabel, prayers: [] }
      current.prayers.push(prayer)
      grouped.set(key, current)
    }

    return Array.from(grouped.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [filteredPrayers])

  const resultCountLabel = `${filteredPrayers.length} prayer${filteredPrayers.length === 1 ? '' : 's'}`

  return (
    <div className={styles.libraryStack}>
      <section className={styles.libraryIntro} aria-label="Prayer library controls">
        <div className={styles.libraryIntroRow}>
          <button
            type="button"
            className={styles.libraryToggle}
            aria-expanded={isLibraryOpen}
            aria-controls="prayer-library-panel"
            onClick={() => setLibraryOpen((current) => !current)}
          >
            {isLibraryOpen ? 'Hide prayer library' : 'Browse prayers'}
          </button>

          {isLibraryOpen ? <p className={styles.filterMeta}>{resultCountLabel}</p> : null}
        </div>
      </section>

      {isLibraryOpen ? (
        <div id="prayer-library-panel" className={styles.libraryPanel}>
          <section className={styles.filterCard}>
            <div className={styles.filterControls}>
              <input
                type="search"
                name="search"
                aria-label="Search prayer names"
                value={query}
                placeholder="Search prayer names"
                className={styles.searchInput}
                onChange={(event) => setQuery(event.target.value)}
              />

              <select
                value={prayerType}
                aria-label="Filter by prayer type"
                className={styles.typeSelect}
                onChange={(event) => setPrayerType(event.target.value)}
              >
                <option value="all">All prayer types</option>
                {prayerTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {groupedPrayers.length === 0 ? (
            <section className={styles.emptyCard} aria-live="polite">
              <h2 className={styles.emptyTitle}>No prayers match that search.</h2>
              <p className={styles.emptyCopy}>Try a broader search or switch back to all prayer types.</p>
            </section>
          ) : (
            groupedPrayers.map((group) => (
              <section key={group.key} className={styles.groupSection} aria-labelledby={`group-${group.key}`}>
                <div className={styles.groupHeader}>
                  <h2 id={`group-${group.key}`} className={styles.groupTitle}>
                    {group.label}
                  </h2>
                  <p className={styles.groupMeta}>
                    {group.prayers.length} prayer{group.prayers.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className={styles.cardGrid}>
                  {group.prayers.map((prayer) => (
                    <Link key={prayer.slug} href={`/spiritual/prayers/${prayer.slug}`} className={styles.prayerCard}>
                      <span className={styles.cardTitle}>{prayer.title}</span>
                      <span className={styles.cardArrow} aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
