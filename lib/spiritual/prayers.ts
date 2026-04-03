import { createAdminClient } from '@/lib/supabase/admin'

type PrayerRow = {
  slug: string
  title: string
  summary: string | null
  body: string
  prayer_type_code: string | null
  status_code: string | null
}

export type PublishedPrayerSummary = {
  slug: string
  title: string
  summary: string | null
  prayerTypeCode: string | null
}

export type PublishedPrayer = PublishedPrayerSummary & {
  body: string
  statusCode: string | null
}

async function fetchPublishedPrayerRows() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('spiritual_content_items')
    .select('slug, title, summary, body, prayer_type_code, status_code')
    .eq('content_kind', 'prayer')
    .eq('status_code', 'published')
    .order('title', { ascending: true })

  if (error) {
    throw new Error(`Could not load published prayers: ${error.message}`)
  }

  return (data as PrayerRow[] | null) ?? []
}

function toSummary(row: PrayerRow): PublishedPrayerSummary {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    prayerTypeCode: row.prayer_type_code,
  }
}

export async function listPublishedPrayers(): Promise<PublishedPrayerSummary[]> {
  const rows = await fetchPublishedPrayerRows()
  return rows
    .filter((row) => row.slug && row.title && row.body)
    .map(toSummary)
}

export async function getPrayerBySlug(slug: string): Promise<PublishedPrayer | null> {
  const rows = await fetchPublishedPrayerRows()
  const row = rows.find((candidate) => candidate.slug === slug)

  if (!row) return null

  return {
    ...toSummary(row),
    body: row.body,
    statusCode: row.status_code,
  }
}
