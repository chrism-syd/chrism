import { createClient } from '@/lib/supabase/server'

type PrayerTypeCode =
  | 'traditional'
  | 'devotion'
  | 'intercession'
  | 'novena'
  | 'liturgy'
  | 'other'
  | null

type ScopeKind = 'global' | 'organization_family' | 'local_unit'

type PrayerRow = {
  id: string
  slug: string
  title: string
  prayer_type: PrayerTypeCode
  summary: string | null
  authority_level: string | null
  source_label: string | null
  source_url: string | null
  sort_order: number
  body_markdown?: string | null
  language_code?: string | null
}

type TopicJoinRow = {
  spiritual_content_item_id: string
  relevance_score: number | null
  spiritual_topics: {
    slug: string
    name: string
  } | null
}

type ScopeJoinRow = {
  spiritual_content_item_id: string
  scope_kind: ScopeKind
}

type RelationshipRow = {
  relationship_kind: string
  parent_content_item_id: string
  child_content_item_id: string
}

export type PrayerTopic = {
  slug: string
  name: string
  relevanceScore: number | null
}

export type PrayerScopeSummary = {
  scopeKind: ScopeKind
  label: string
}

export type PrayerListItem = {
  id: string
  slug: string
  title: string
  prayerType: PrayerTypeCode
  prayerTypeLabel: string
  summary: string | null
  authorityLevel: string | null
  authorityLabel: string | null
  sourceLabel: string | null
  sourceUrl: string | null
  sortOrder: number
  topics: PrayerTopic[]
  scopes: PrayerScopeSummary[]
  searchText: string
}

export type PrayerDetail = PrayerListItem & {
  bodyMarkdown: string | null
  languageCode: string | null
  relatedPrayers: Array<{
    slug: string
    title: string
    prayerType: PrayerTypeCode
    prayerTypeLabel: string
    relationshipKind: string
  }>
}

function normalizeSearchText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function titleizeDashed(value: string) {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

export function formatPrayerTypeLabel(code: PrayerTypeCode) {
  switch (code) {
    case 'traditional':
      return 'Traditional'
    case 'devotion':
      return 'Devotional'
    case 'intercession':
      return 'Intercessory'
    case 'novena':
      return 'Novena'
    case 'liturgy':
      return 'Liturgy'
    case 'other':
      return 'Other'
    default:
      return 'Prayer'
  }
}

export function formatAuthorityLabel(value: string | null) {
  if (!value) return null

  switch (value) {
    case 'vatican':
      return 'Vatican source'
    case 'bishops_conference':
      return 'Bishops conference'
    case 'official_association_site':
      return 'Official association source'
    case 'official_order_site':
      return 'Official order source'
    case 'user_custom':
      return 'Draft custom prayer'
    default:
      return titleizeDashed(value)
  }
}

function formatScopeLabel(scopeKind: ScopeKind) {
  switch (scopeKind) {
    case 'global':
      return 'Global'
    case 'organization_family':
      return 'Organization family'
    case 'local_unit':
      return 'Local unit'
    default:
      return titleizeDashed(scopeKind)
  }
}

function assertNoError(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

function buildTopicsMap(rows: TopicJoinRow[] | null) {
  const topicMap = new Map<string, PrayerTopic[]>()

  for (const row of rows ?? []) {
    const topic = row.spiritual_topics
    if (!topic) continue

    const current = topicMap.get(row.spiritual_content_item_id) ?? []
    current.push({
      slug: topic.slug,
      name: topic.name,
      relevanceScore: row.relevance_score,
    })
    topicMap.set(row.spiritual_content_item_id, current)
  }

  for (const [key, value] of topicMap.entries()) {
    topicMap.set(
      key,
      value.sort((left, right) => {
        const leftScore = left.relevanceScore ?? 0
        const rightScore = right.relevanceScore ?? 0
        if (leftScore !== rightScore) return rightScore - leftScore
        return left.name.localeCompare(right.name)
      })
    )
  }

  return topicMap
}

function buildScopeMap(rows: ScopeJoinRow[] | null) {
  const scopeMap = new Map<string, PrayerScopeSummary[]>()

  for (const row of rows ?? []) {
    const current = scopeMap.get(row.spiritual_content_item_id) ?? []
    if (!current.some((entry) => entry.scopeKind === row.scope_kind)) {
      current.push({
        scopeKind: row.scope_kind,
        label: formatScopeLabel(row.scope_kind),
      })
    }
    scopeMap.set(row.spiritual_content_item_id, current)
  }

  return scopeMap
}

function buildPrayerListItem(
  row: PrayerRow,
  topicMap: Map<string, PrayerTopic[]>,
  scopeMap: Map<string, PrayerScopeSummary[]>
): PrayerListItem {
  const topics = topicMap.get(row.id) ?? []
  const scopes = scopeMap.get(row.id) ?? [{ scopeKind: 'global', label: 'Global' }]
  const prayerTypeLabel = formatPrayerTypeLabel(row.prayer_type)
  const authorityLabel = formatAuthorityLabel(row.authority_level)

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    prayerType: row.prayer_type,
    prayerTypeLabel,
    summary: row.summary,
    authorityLevel: row.authority_level,
    authorityLabel,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    sortOrder: row.sort_order,
    topics,
    scopes,
    searchText: normalizeSearchText([
      row.title,
      row.summary,
      prayerTypeLabel,
      authorityLabel,
      row.source_label,
      ...topics.map((topic) => topic.name),
    ].filter(Boolean).join(' ')),
  }
}

export async function listPublishedPrayers() {
  const supabase = await createClient()
  const { data: prayersData, error: prayersError } = await supabase
    .from('spiritual_content_items')
    .select('id, slug, title, prayer_type, summary, authority_level, source_label, source_url, sort_order')
    .eq('content_kind', 'prayer')
    .eq('is_active', true)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  assertNoError(prayersError, 'Unable to load prayer library')

  const prayers = ((prayersData as PrayerRow[] | null) ?? []).filter((row) => row.slug)
  if (prayers.length === 0) return []

  const prayerIds = prayers.map((row) => row.id)

  const [{ data: topicRows, error: topicError }, { data: scopeRows, error: scopeError }] = await Promise.all([
    supabase
      .from('spiritual_content_topics')
      .select('spiritual_content_item_id, relevance_score, spiritual_topics ( slug, name )')
      .in('spiritual_content_item_id', prayerIds),
    supabase
      .from('spiritual_content_scopes')
      .select('spiritual_content_item_id, scope_kind')
      .in('spiritual_content_item_id', prayerIds),
  ])

  assertNoError(topicError, 'Unable to load prayer topics')
  assertNoError(scopeError, 'Unable to load prayer scopes')

  const topicMap = buildTopicsMap((topicRows as unknown as TopicJoinRow[] | null) ?? [])
  const scopeMap = buildScopeMap((scopeRows as ScopeJoinRow[] | null) ?? [])

  return prayers.map((row) => buildPrayerListItem(row, topicMap, scopeMap))
}

export async function getPrayerBySlug(slug: string): Promise<PrayerDetail | null> {
  const supabase = await createClient()
  const { data: prayerData, error: prayerError } = await supabase
    .from('spiritual_content_items')
    .select(
      'id, slug, title, prayer_type, summary, authority_level, source_label, source_url, sort_order, body_markdown, language_code'
    )
    .eq('slug', slug)
    .eq('content_kind', 'prayer')
    .eq('is_active', true)
    .eq('is_published', true)
    .maybeSingle()

  assertNoError(prayerError, 'Unable to load prayer')
  if (!prayerData) return null

  const prayer = prayerData as PrayerRow

  const [
    { data: topicRows, error: topicError },
    { data: scopeRows, error: scopeError },
    { data: relationshipRows, error: relationshipError },
  ] = await Promise.all([
    supabase
      .from('spiritual_content_topics')
      .select('spiritual_content_item_id, relevance_score, spiritual_topics ( slug, name )')
      .eq('spiritual_content_item_id', prayer.id),
    supabase
      .from('spiritual_content_scopes')
      .select('spiritual_content_item_id, scope_kind')
      .eq('spiritual_content_item_id', prayer.id),
    supabase
      .from('spiritual_content_relationships')
      .select('relationship_kind, parent_content_item_id, child_content_item_id')
      .or(`parent_content_item_id.eq.${prayer.id},child_content_item_id.eq.${prayer.id}`),
  ])

  assertNoError(topicError, 'Unable to load prayer topics')
  assertNoError(scopeError, 'Unable to load prayer scopes')
  assertNoError(relationshipError, 'Unable to load related prayers')

  const topicMap = buildTopicsMap((topicRows as unknown as TopicJoinRow[] | null) ?? [])
  const scopeMap = buildScopeMap((scopeRows as ScopeJoinRow[] | null) ?? [])
  const base = buildPrayerListItem(prayer, topicMap, scopeMap)

  const relatedRows = (relationshipRows as RelationshipRow[] | null) ?? []
  const relatedIds = Array.from(
    new Set(
      relatedRows.map((row) =>
        row.parent_content_item_id === prayer.id ? row.child_content_item_id : row.parent_content_item_id
      )
    )
  )

  let relatedPrayers: PrayerDetail['relatedPrayers'] = []
  if (relatedIds.length > 0) {
    const { data: relatedData, error: relatedError } = await supabase
      .from('spiritual_content_items')
      .select('id, slug, title, prayer_type')
      .in('id', relatedIds)
      .eq('content_kind', 'prayer')
      .eq('is_active', true)
      .eq('is_published', true)

    assertNoError(relatedError, 'Unable to load related prayer cards')

    const relatedMap = new Map(
      (((relatedData as Array<{ id: string; slug: string; title: string; prayer_type: PrayerTypeCode }> | null) ?? []).map(
        (row) => [row.id, row]
      ))
    )

    relatedPrayers = relatedRows
      .map((row) => {
        const relatedId = row.parent_content_item_id === prayer.id ? row.child_content_item_id : row.parent_content_item_id
        const related = relatedMap.get(relatedId)
        if (!related) return null
        return {
          slug: related.slug,
          title: related.title,
          prayerType: related.prayer_type,
          prayerTypeLabel: formatPrayerTypeLabel(related.prayer_type),
          relationshipKind: titleizeDashed(row.relationship_kind),
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  }

  return {
    ...base,
    bodyMarkdown: prayer.body_markdown ?? null,
    languageCode: prayer.language_code ?? null,
    relatedPrayers,
  }
}
