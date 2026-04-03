'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import styles from './prayer-library.module.css'

type PrayerCard = {
  slug: string
  title: string
  summary: string | null
  prayerTypeCode: string | null
}

type Props = {
  prayers: PrayerCard[]
}

const FILTERS = [
  { value: 'all', label: 'All prayers' },
  { value: 'traditional', label: 'Traditional' },
  { value: 'litany', label: 'Litanies' },
  { value: 'novena', label: 'Novenas' },
  { value: 'chaplet', label: 'Chaplets' },
  { value: 'blessing', label: 'Blessings' },
  { value: 'devotion', label: 'Devotions' },
  { value: 'intercession', label: 'Intercessions' },
]

function matchesType(prayerTypeCode: string | null, filter: string) {
  if (filter === 'all') return true
  return (prayerTypeCode ?? 'traditional') === filter
}

function typeLabel(prayerTypeCode: string | null) {
  switch (prayerTypeCode) {
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

export default function PrayerLibraryClient({ prayers }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const filteredPrayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return prayers.filter((prayer) => {
      if (!matchesType(prayer.prayerTypeCode, filter)) return false
      if (!normalizedQuery) return true

      const haystack = [prayer.title, prayer.summary ?? '', typeLabel(prayer.prayerTypeCode)]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [filter, prayers, query])

  return (
    <section className={styles.librarySection}>
      <div className={styles.controlsRow}>
        <label className={styles.searchControl}>
          <span className={styles.controlLabel}>Search</span>
          <input
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prayers, devotions, blessings…"
          />
        </label>

        <label className={styles.filterControl}>
          <span className={styles.controlLabel}>Type</span>
          <select className={styles.filterSelect} value={filter} onChange={(event) => setFilter(event.target.value)}>
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredPrayers.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No prayers match this view yet.</h2>
          <p>Try a different filter or search term.</p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filteredPrayers.map((prayer) => (
            <Link key={prayer.slug} href={`/spiritual/prayers/${prayer.slug}`} className={styles.cardLink}>
              <article className={styles.prayerCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardBadge}>{typeLabel(prayer.prayerTypeCode)}</span>
                </div>
                <h2 className={styles.cardTitle}>{prayer.title}</h2>
                <p className={styles.cardBody}>{prayer.summary ?? 'Open this prayer to read the full text.'}</p>
                <span className={styles.cardAction}>Open prayer</span>
              </article>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
