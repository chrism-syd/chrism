import { createClient } from '@/lib/supabase/server'

export type SaintListItem = {
  id: string
  slug: string
  canonicalName: string
  commonName: string | null
  shortBio: string | null
  patronSummary: string | null
  feastMonth: number | null
  feastDay: number | null
  aliases: string[]
  topics: Array<{
    slug: string
    name: string
    relevanceScore: number | null
  }>
  searchText: string
}

type SaintRow = {
  id: string
  slug: string
  canonical_name: string
  common_name: string | null
  short_bio: string | null
  patron_summary: string | null
  feast_month: number | null
  feast_day: number | null
  is_active: boolean
}

type SaintAliasRow = {
  saint_id: string
  alias: string
}

type SaintTopicRow = {
  saint_id: string
  relevance_score: number | null
  spiritual_topics: {
    slug: string
    name: string
  } | null
}

function assertNoError(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

function formatFeastLabel(month: number | null, day: number | null) {
  if (!month || !day) return null
  return `${month}/${day}`
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export async function listSaints(): Promise<SaintListItem[]> {
  const supabase = await createClient()

  const { data: saintsData, error: saintsError } = await supabase
    .from('saints')
    .select('id, slug, canonical_name, common_name, short_bio, patron_summary, feast_month, feast_day, is_active')
    .eq('is_active', true)
    .order('common_name', { ascending: true })
    .order('canonical_name', { ascending: true })

  assertNoError(saintsError, 'Unable to load saints')

  const saints = ((saintsData as SaintRow[] | null) ?? []).filter((row) => row.slug)
  if (saints.length === 0) return []

  const saintIds = saints.map((row) => row.id)
  const saintIdChunks = chunkArray(saintIds, 200)

  const aliasMap = new Map<string, string[]>()
  const topicMap = new Map<string, SaintListItem['topics']>()

  for (const saintIdChunk of saintIdChunks) {
    const [
      { data: aliasRows, error: aliasError },
      { data: topicRows, error: topicError },
    ] = await Promise.all([
      supabase.from('saint_aliases').select('saint_id, alias').in('saint_id', saintIdChunk),
      supabase
        .from('saint_topics')
        .select('saint_id, relevance_score, spiritual_topics ( slug, name )')
        .in('saint_id', saintIdChunk),
    ])

    assertNoError(aliasError, 'Unable to load saint aliases')
    assertNoError(topicError, 'Unable to load saint topics')

    for (const row of (aliasRows as SaintAliasRow[] | null) ?? []) {
      const current = aliasMap.get(row.saint_id) ?? []
      current.push(row.alias)
      aliasMap.set(row.saint_id, current)
    }

    for (const row of (topicRows as SaintTopicRow[] | null) ?? []) {
      const topic = row.spiritual_topics
      if (!topic) continue
      const current = topicMap.get(row.saint_id) ?? []
      current.push({
        slug: topic.slug,
        name: topic.name,
        relevanceScore: row.relevance_score,
      })
      topicMap.set(row.saint_id, current)
    }
  }

  for (const [key, topics] of topicMap.entries()) {
    topicMap.set(
      key,
      topics.sort((left, right) => {
        const leftScore = left.relevanceScore ?? 0
        const rightScore = right.relevanceScore ?? 0
        if (leftScore !== rightScore) return rightScore - leftScore
        return left.name.localeCompare(right.name)
      })
    )
  }

  return saints.map((saint) => {
    const aliases = aliasMap.get(saint.id) ?? []
    const topics = topicMap.get(saint.id) ?? []
    const primaryName = saint.common_name ?? saint.canonical_name
    const feastLabel = formatFeastLabel(saint.feast_month, saint.feast_day)

    return {
      id: saint.id,
      slug: saint.slug,
      canonicalName: saint.canonical_name,
      commonName: saint.common_name,
      shortBio: saint.short_bio,
      patronSummary: saint.patron_summary,
      feastMonth: saint.feast_month,
      feastDay: saint.feast_day,
      aliases,
      topics,
      searchText: [
        primaryName,
        saint.canonical_name,
        saint.common_name,
        saint.short_bio,
        saint.patron_summary,
        feastLabel,
        ...aliases,
        ...topics.map((topic) => topic.name),
      ]
        .filter(Boolean)
        .join(' ')
        .trim()
        .toLowerCase(),
    }
  })
}
