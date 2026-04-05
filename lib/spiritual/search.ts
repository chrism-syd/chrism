import { listCatechismReferences, type CatechismListItem } from '@/lib/spiritual/catechism'
import { listPublishedPrayers, type PrayerListItem } from '@/lib/spiritual/prayers'
import { listSaints, type SaintListItem } from '@/lib/spiritual/saints'

export type SpiritualSearchInput = {
  query?: string | null
  saintSlug?: string | null
  topicSlug?: string | null
}

type SearchMode = 'saint' | 'topic' | 'need' | 'prayer' | 'catechism'

type ThemeChip = {
  slug: string
  name: string
}

type PivotItem = {
  kind: 'saint'
  slug: string
  title: string
  subtitle: string | null
}

type StartHerePayload = {
  mode: SearchMode
  title: string
  description: string
  featuredPrayer: PrayerListItem | null
  featuredSaint: SaintListItem | null
  featuredCatechism: CatechismListItem | null
  relatedThemes: ThemeChip[]
}

export type SpiritualSearchResults = {
  query: string
  interpretationLabel: string
  activePivotLabel: string | null
  pivotHeading: string
  pivotCopy: string | null
  startHere: StartHerePayload | null
  pivots: PivotItem[]
  saints: SaintListItem[]
  prayers: PrayerListItem[]
  catechism: CatechismListItem[]
  relatedThemes: ThemeChip[]
}

function normalizeQuery(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function titleCaseQuery(value: string) {
  if (!value) return 'this path'
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>()
  const output: T[] = []

  for (const item of items) {
    const key = getKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(item)
  }

  return output
}

function topicScore(topicNames: string[], normalizedQuery: string) {
  if (topicNames.some((topic) => topic === normalizedQuery)) return 70
  if (topicNames.some((topic) => topic.includes(normalizedQuery))) return 45
  return 0
}

function scorePrayer(prayer: PrayerListItem, normalizedQuery: string) {
  if (!normalizedQuery) return 0

  const title = prayer.title.toLowerCase()
  const summary = prayer.summary?.toLowerCase() ?? ''
  const typeLabel = prayer.prayerTypeLabel.toLowerCase()
  const topicNames = prayer.topics.map((topic) => topic.name.toLowerCase())

  if (title === normalizedQuery) return 100
  if (title.startsWith(normalizedQuery)) return 85
  if (title.includes(normalizedQuery)) return 70

  const relatedTopicScore = topicScore(topicNames, normalizedQuery)
  if (relatedTopicScore > 0) return relatedTopicScore

  if (summary.includes(normalizedQuery)) return 35
  if (typeLabel.includes(normalizedQuery)) return 20
  if (prayer.searchText.includes(normalizedQuery)) return 10

  return 0
}

function scoreSaint(saint: SaintListItem, normalizedQuery: string) {
  if (!normalizedQuery) return 0

  const primaryName = (saint.commonName ?? saint.canonicalName).toLowerCase()
  const canonicalName = saint.canonicalName.toLowerCase()
  const commonName = saint.commonName?.toLowerCase() ?? ''
  const shortBio = saint.shortBio?.toLowerCase() ?? ''
  const patronSummary = saint.patronSummary?.toLowerCase() ?? ''
  const aliases = saint.aliases.map((alias) => alias.toLowerCase())
  const topicNames = saint.topics.map((topic) => topic.name.toLowerCase())

  if (primaryName === normalizedQuery) return 110
  if (canonicalName === normalizedQuery) return 105
  if (aliases.includes(normalizedQuery)) return 100
  if (primaryName.startsWith(normalizedQuery)) return 90
  if (canonicalName.startsWith(normalizedQuery)) return 88
  if (primaryName.includes(normalizedQuery) || commonName.includes(normalizedQuery)) return 75

  const relatedTopicScore = topicScore(topicNames, normalizedQuery)
  if (relatedTopicScore > 0) return relatedTopicScore

  if (aliases.some((alias) => alias.includes(normalizedQuery))) return 55
  if (patronSummary.includes(normalizedQuery)) return 40
  if (shortBio.includes(normalizedQuery)) return 30
  if (saint.searchText.includes(normalizedQuery)) return 10

  return 0
}

function scoreCatechism(reference: CatechismListItem, normalizedQuery: string) {
  if (!normalizedQuery) return 0

  const referenceCode = reference.referenceCode.toLowerCase()
  const title = reference.title?.toLowerCase() ?? ''
  const summary = reference.summary?.toLowerCase() ?? ''
  const bodyExcerpt = reference.bodyExcerpt?.toLowerCase() ?? ''
  const topicNames = reference.topics.map((topic) => topic.name.toLowerCase())

  if (referenceCode === normalizedQuery) return 105
  if (title === normalizedQuery) return 100
  if (referenceCode.includes(normalizedQuery)) return 90
  if (title.startsWith(normalizedQuery)) return 85
  if (title.includes(normalizedQuery)) return 70

  const relatedTopicScore = topicScore(topicNames, normalizedQuery)
  if (relatedTopicScore > 0) return relatedTopicScore

  if (summary.includes(normalizedQuery)) return 35
  if (bodyExcerpt.includes(normalizedQuery)) return 30
  if (reference.searchText.includes(normalizedQuery)) return 10

  return 0
}

function collectThemes(
  featuredSaint: SaintListItem | null,
  featuredPrayer: PrayerListItem | null,
  featuredCatechism: CatechismListItem | null
): ThemeChip[] {
  return uniqueBy(
    [
      ...(featuredSaint?.topics ?? []),
      ...(featuredPrayer?.topics ?? []),
      ...(featuredCatechism?.topics ?? []),
    ].map((topic) => ({ slug: topic.slug, name: topic.name })),
    (topic) => topic.slug
  ).slice(0, 6)
}

function buildPivotMeta(mode: SearchMode, query: string) {
  const clean = titleCaseQuery(query)

  if (mode === 'saint') {
    return {
      heading: clean ? `Not the ${clean} you were looking for?` : 'Looking for another saintly path?',
      copy: 'You can begin with another saintly path.',
    }
  }

  if (mode === 'topic' || mode === 'need') {
    return {
      heading: 'You may want to begin with',
      copy: 'A few nearby companions and paths that may fit what you are reaching for.',
    }
  }

  return {
    heading: 'Looking for another path?',
    copy: 'You may want to begin here instead.',
  }
}

function saintHasStrongNameMatch(saint: SaintListItem, normalizedQuery: string) {
  if (!normalizedQuery) return false

  const primaryName = (saint.commonName ?? saint.canonicalName).toLowerCase()
  const canonicalName = saint.canonicalName.toLowerCase()
  const aliases = saint.aliases.map((alias) => alias.toLowerCase())

  return (
    primaryName === normalizedQuery ||
    canonicalName === normalizedQuery ||
    aliases.includes(normalizedQuery) ||
    primaryName.startsWith(normalizedQuery) ||
    canonicalName.startsWith(normalizedQuery)
  )
}

export async function searchSpiritualContent(input: SpiritualSearchInput): Promise<SpiritualSearchResults> {
  const query = input.query?.trim() ?? ''
  const normalizedQuery = normalizeQuery(input.query)
  const saintSlug = input.saintSlug?.trim() ?? ''
  const topicSlug = input.topicSlug?.trim() ?? ''

  if (!normalizedQuery && !saintSlug && !topicSlug) {
    return {
      query,
      interpretationLabel: 'A quiet place to begin',
      activePivotLabel: null,
      pivotHeading: 'Looking for another path?',
      pivotCopy: null,
      startHere: null,
      pivots: [],
      saints: [],
      prayers: [],
      catechism: [],
      relatedThemes: [],
    }
  }

  const [saints, prayers, catechism] = await Promise.all([
    listSaints(),
    listPublishedPrayers(),
    listCatechismReferences(),
  ])

  const rankedSaintsWithScores = saints
    .map((saint) => ({
      item: saint,
      score: saintSlug ? (saint.slug === saintSlug ? 1000 : 0) : scoreSaint(saint, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      return (left.item.commonName ?? left.item.canonicalName).localeCompare(
        right.item.commonName ?? right.item.canonicalName
      )
    })

  const rankedSaints = rankedSaintsWithScores.map((entry) => entry.item)

  const pivotSaint = saintSlug ? rankedSaints[0] ?? null : null

  const explicitTopic = topicSlug
    ? uniqueBy(
        saints.flatMap((saint) => saint.topics).map((topic) => ({ slug: topic.slug, name: topic.name })),
        (topic) => topic.slug
      ).find((topic) => topic.slug === topicSlug) ?? null
    : null

  const queryMatchedTopics = normalizedQuery
    ? uniqueBy(
        [
          ...saints.flatMap((saint) => saint.topics),
          ...prayers.flatMap((prayer) => prayer.topics),
          ...catechism.flatMap((reference) => reference.topics),
        ]
          .filter((topic) => {
            const topicName = topic.name.toLowerCase()
            return topicName === normalizedQuery || topicName.includes(normalizedQuery)
          })
          .map((topic) => ({ slug: topic.slug, name: topic.name })),
        (topic) => topic.slug
      )
    : []

  const activeTopicNames = uniqueBy(
    [
      ...(explicitTopic ? [explicitTopic] : []),
      ...queryMatchedTopics,
      ...(pivotSaint?.topics ?? []).map((topic) => ({ slug: topic.slug, name: topic.name })),
    ],
    (topic) => topic.slug
  )

  const rankedPrayers = prayers
    .map((prayer) => {
      let score = scorePrayer(prayer, normalizedQuery)

      if (
        pivotSaint &&
        prayer.topics.some((topic) => pivotSaint.topics.some((saintTopic) => saintTopic.slug === topic.slug))
      ) {
        score += 40
      }

      if (
        activeTopicNames.length > 0 &&
        prayer.topics.some((topic) => activeTopicNames.some((theme) => theme.slug === topic.slug))
      ) {
        score += 30
      }

      return { item: prayer, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      if (left.item.sortOrder !== right.item.sortOrder) return left.item.sortOrder - right.item.sortOrder
      return left.item.title.localeCompare(right.item.title)
    })
    .map((entry) => entry.item)

  const rankedCatechism = catechism
    .map((reference) => {
      let score = scoreCatechism(reference, normalizedQuery)

      if (
        pivotSaint &&
        reference.topics.some((topic) => pivotSaint.topics.some((saintTopic) => saintTopic.slug === topic.slug))
      ) {
        score += 35
      }

      if (
        activeTopicNames.length > 0 &&
        reference.topics.some((topic) => activeTopicNames.some((theme) => theme.slug === topic.slug))
      ) {
        score += 25
      }

      return { item: reference, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      return left.item.referenceCode.localeCompare(right.item.referenceCode)
    })
    .map((entry) => entry.item)

  const strongestSaint = rankedSaints[0] ?? null
  const saintLooksDominant =
    Boolean(pivotSaint) ||
    (strongestSaint ? saintHasStrongNameMatch(strongestSaint, normalizedQuery) : false)

  const topicLooksDominant =
    Boolean(explicitTopic) ||
    (!saintLooksDominant && activeTopicNames.length > 0)

  const featuredSaint =
    saintLooksDominant ? pivotSaint ?? strongestSaint : rankedSaints[0] ?? null

  const featuredPrayer = rankedPrayers[0] ?? null
  const featuredCatechism = rankedCatechism[0] ?? null
  const relatedThemes = collectThemes(featuredSaint, featuredPrayer, featuredCatechism)

  const mode: SearchMode = saintLooksDominant
    ? 'saint'
    : topicLooksDominant
      ? 'topic'
      : featuredPrayer
        ? 'prayer'
        : featuredCatechism
          ? 'catechism'
          : 'need'

  const leadingTopic = explicitTopic ?? activeTopicNames[0] ?? null

  const interpretationLabel =
    mode === 'saint' && featuredSaint
      ? `Beginning with ${featuredSaint.commonName ?? featuredSaint.canonicalName}`
      : mode === 'topic' && leadingTopic
        ? `A path for ${leadingTopic.name.toLowerCase()}`
        : mode === 'prayer'
          ? 'Starting with prayer'
          : mode === 'catechism'
            ? 'Grounded in the faith'
            : `A path for ${titleCaseQuery(query).toLowerCase()}`

  const startHere =
    featuredSaint || featuredPrayer || featuredCatechism
      ? {
          mode,
          title:
            mode === 'saint' && featuredSaint
              ? `${featuredSaint.commonName ?? featuredSaint.canonicalName}`
              : mode === 'topic' && leadingTopic
                ? `For ${leadingTopic.name.toLowerCase()}`
                : query
                  ? `For ${titleCaseQuery(query).toLowerCase()}`
                  : 'A quiet place to begin',
          description:
            mode === 'saint'
              ? 'A gentle starting point through prayer, witness, and a few nearby themes worth staying with.'
              : mode === 'topic'
                ? 'A grounded place to begin through prayer, witness, and quiet guidance.'
                : 'A quiet place to begin, with a few steady paths to stay with.',
          featuredPrayer,
          featuredSaint,
          featuredCatechism,
          relatedThemes,
        }
      : null

  const pivots =
    mode === 'saint' && !saintSlug && rankedSaints.length > 1
      ? rankedSaints.slice(1, 4).map((saint) => ({
          kind: 'saint' as const,
          slug: saint.slug,
          title: saint.commonName ?? saint.canonicalName,
          subtitle: saint.patronSummary ?? saint.shortBio ?? null,
        }))
      : mode === 'topic'
        ? uniqueBy(
            rankedSaints
              .filter((saint) =>
                leadingTopic
                  ? saint.topics.some((topic) => topic.slug === leadingTopic.slug)
                  : true
              )
              .slice(0, 3)
              .map((saint) => ({
                kind: 'saint' as const,
                slug: saint.slug,
                title: saint.commonName ?? saint.canonicalName,
                subtitle: saint.patronSummary ?? saint.shortBio ?? null,
              })),
            (saint) => saint.slug
          )
        : []

  const pivotMeta = buildPivotMeta(mode, query || featuredSaint?.commonName || featuredSaint?.canonicalName || 'path')

  return {
    query,
    interpretationLabel,
    activePivotLabel:
      saintSlug && pivotSaint ? `Centered on ${pivotSaint.commonName ?? pivotSaint.canonicalName}` : null,
    pivotHeading: pivotMeta.heading,
    pivotCopy: pivotMeta.copy,
    startHere,
    pivots,
    saints: uniqueBy(
      rankedSaints.filter((saint) => !featuredSaint || saint.slug !== featuredSaint.slug),
      (saint) => saint.slug
    ).slice(0, 3),
    prayers: uniqueBy(
      rankedPrayers.filter((prayer) => !featuredPrayer || prayer.slug !== featuredPrayer.slug),
      (prayer) => prayer.slug
    ).slice(0, 4),
    catechism: uniqueBy(
      rankedCatechism.filter((reference) => !featuredCatechism || reference.slug !== featuredCatechism.slug),
      (reference) => reference.slug
    ).slice(0, 2),
    relatedThemes,
  }
}