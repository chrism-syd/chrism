import { createClient } from '@/lib/supabase/server'

export type CatechismListItem = {
  id: string
  slug: string
  referenceCode: string
  title: string | null
  summary: string | null
  bodyExcerpt: string | null
  topics: Array<{
    slug: string
    name: string
    relevanceScore: number | null
  }>
  searchText: string
}

type CatechismRow = {
  id: string
  slug: string
  reference_code: string
  title: string | null
  summary: string | null
  body_excerpt: string | null
  is_active: boolean
}

type CatechismTopicRow = {
  catechism_reference_id: string
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

export async function listCatechismReferences(): Promise<CatechismListItem[]> {
  const supabase = await createClient()

  const { data: referencesData, error: referencesError } = await supabase
    .from('catechism_references')
    .select('id, slug, reference_code, title, summary, body_excerpt, is_active')
    .eq('is_active', true)
    .order('reference_code', { ascending: true })

  assertNoError(referencesError, 'Unable to load catechism references')

  const references = ((referencesData as CatechismRow[] | null) ?? []).filter((row) => row.slug)
  if (references.length === 0) return []

  const referenceIds = references.map((row) => row.id)

  const { data: topicRows, error: topicError } = await supabase
    .from('catechism_topics')
    .select('catechism_reference_id, relevance_score, spiritual_topics ( slug, name )')
    .in('catechism_reference_id', referenceIds)

  assertNoError(topicError, 'Unable to load catechism topics')

  const topicMap = new Map<string, CatechismListItem['topics']>()
  for (const row of (topicRows as CatechismTopicRow[] | null) ?? []) {
    const topic = row.spiritual_topics
    if (!topic) continue
    const current = topicMap.get(row.catechism_reference_id) ?? []
    current.push({
      slug: topic.slug,
      name: topic.name,
      relevanceScore: row.relevance_score,
    })
    topicMap.set(row.catechism_reference_id, current)
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

  return references.map((reference) => {
    const topics = topicMap.get(reference.id) ?? []

    return {
      id: reference.id,
      slug: reference.slug,
      referenceCode: reference.reference_code,
      title: reference.title,
      summary: reference.summary,
      bodyExcerpt: reference.body_excerpt,
      topics,
      searchText: [
        reference.reference_code,
        reference.title,
        reference.summary,
        reference.body_excerpt,
        ...topics.map((topic) => topic.name),
      ]
        .filter(Boolean)
        .join(' ')
        .trim()
        .toLowerCase(),
    }
  })
}
