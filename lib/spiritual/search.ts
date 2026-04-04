import { listCatechismReferences, type CatechismListItem } from '@/lib/spiritual/catechism'
import { listPublishedPrayers, type PrayerListItem } from '@/lib/spiritual/prayers'
import { listSaints, type SaintListItem } from '@/lib/spiritual/saints'

export type SpiritualSearchResults = {
  query: string
  saints: SaintListItem[]
  prayers: PrayerListItem[]
  catechism: CatechismListItem[]
}

function normalizeQuery(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
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

export async function searchSpiritualContent(rawQuery: string | null | undefined): Promise<SpiritualSearchResults> {
  const query = rawQuery?.trim() ?? ''
  const normalizedQuery = normalizeQuery(rawQuery)

  if (!normalizedQuery) {
    return {
      query,
      saints: [],
      prayers: [],
      catechism: [],
    }
  }

  const [saints, prayers, catechism] = await Promise.all([
    listSaints(),
    listPublishedPrayers(),
    listCatechismReferences(),
  ])

  const rankedSaints = saints
    .map((saint) => ({ item: saint, score: scoreSaint(saint, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      return (left.item.commonName ?? left.item.canonicalName).localeCompare(
        right.item.commonName ?? right.item.canonicalName
      )
    })
    .map((entry) => entry.item)

  const rankedPrayers = prayers
    .map((prayer) => ({ item: prayer, score: scorePrayer(prayer, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      if (left.item.sortOrder !== right.item.sortOrder) return left.item.sortOrder - right.item.sortOrder
      return left.item.title.localeCompare(right.item.title)
    })
    .map((entry) => entry.item)

  const rankedCatechism = catechism
    .map((reference) => ({ item: reference, score: scoreCatechism(reference, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      return left.item.referenceCode.localeCompare(right.item.referenceCode)
    })
    .map((entry) => entry.item)

  return {
    query,
    saints: rankedSaints,
    prayers: rankedPrayers,
    catechism: rankedCatechism,
  }
}
