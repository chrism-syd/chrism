import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

type RouteEntry = {
  route: string
  routeLabel: string
  sectionKey: string
  sectionLabel: string
  filePath: string
  isDynamic: boolean
  depth: number
}

export type SiteMapSection = {
  key: string
  label: string
  entries: RouteEntry[]
}

const APP_DIR = path.join(process.cwd(), 'app')

const SECTION_META: Array<{ match: RegExp; key: string; label: string }> = [
  { match: /^\/$/, key: 'general', label: 'General' },
  { match: /^\/(about|home|login)(\/|$)/, key: 'public', label: 'Public pages' },
  { match: /^\/auth(\/|$)/, key: 'auth', label: 'Auth' },
  { match: /^\/(claim-organization|me\/claim-organization|admin-invite)(\/|$)/, key: 'onboarding', label: 'Onboarding and claims' },
  { match: /^\/me(\/|$)/, key: 'workspace', label: 'Signed-in workspace' },
  { match: /^\/members(\/|$)/, key: 'members', label: 'Members and officers' },
  { match: /^\/(events|rsvp)(\/|$)/, key: 'events', label: 'Events and RSVP' },
  { match: /^\/custom-lists(\/|$)/, key: 'lists', label: 'Custom lists' },
  { match: /^\/imports(\/|$)/, key: 'imports', label: 'Imports and operations' },
  { match: /^\/super-admin(\/|$)/, key: 'super-admin', label: 'Super admin' },
  { match: /^\/components\/testing(\/|$)/, key: 'testing', label: 'Testing and QA' },
]

function isSkippableSegment(segment: string) {
  return (
    !segment ||
    segment.startsWith('_') ||
    segment.startsWith('(') ||
    segment.startsWith('@')
  )
}

function titleCase(value: string) {
  return value
    .replace(/[\[\]]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function labelForRoute(route: string) {
  if (route === '/') {
    return 'Landing page'
  }

  const segments = route.split('/').filter(Boolean)
  return segments
    .map((segment) => {
      if (segment.startsWith('[') && segment.endsWith(']')) {
        return `${titleCase(segment.slice(1, -1))} detail`
      }
      return titleCase(segment)
    })
    .join(' / ')
}

function normalizeRouteFromSegments(segments: string[]) {
  const filtered = segments.filter((segment) => !isSkippableSegment(segment))
  if (filtered.length === 0) {
    return '/'
  }
  return `/${filtered.join('/')}`
}

function sectionForRoute(route: string) {
  const matched = SECTION_META.find((item) => item.match.test(route))
  return matched ?? { key: 'other', label: 'Other pages' }
}

function walkAppPages(args: { currentDir: string; segments: string[]; entries: RouteEntry[] }) {
  const names = readdirSync(args.currentDir)

  for (const name of names) {
    const fullPath = path.join(args.currentDir, name)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      walkAppPages({
        currentDir: fullPath,
        segments: [...args.segments, name],
        entries: args.entries,
      })
      continue
    }

    if (!stats.isFile() || name !== 'page.tsx') {
      continue
    }

    const relativeDir = path.relative(APP_DIR, path.dirname(fullPath))
    const route = normalizeRouteFromSegments(relativeDir === '' ? [] : relativeDir.split(path.sep))
    const section = sectionForRoute(route)

    args.entries.push({
      route,
      routeLabel: labelForRoute(route),
      sectionKey: section.key,
      sectionLabel: section.label,
      filePath: path.relative(process.cwd(), fullPath),
      isDynamic: /\[[^/]+\]/.test(route),
      depth: route === '/' ? 0 : route.split('/').filter(Boolean).length,
    })
  }
}

export function getAppSiteMapSections(): SiteMapSection[] {
  const entries: RouteEntry[] = []
  walkAppPages({ currentDir: APP_DIR, segments: [], entries })

  const filteredEntries = entries.filter((entry) => entry.route !== '/components/testing')
  filteredEntries.sort((left, right) => {
    if (left.sectionLabel !== right.sectionLabel) {
      return left.sectionLabel.localeCompare(right.sectionLabel)
    }
    if (left.depth !== right.depth) {
      return left.depth - right.depth
    }
    return left.route.localeCompare(right.route)
  })

  const grouped = new Map<string, SiteMapSection>()

  for (const entry of filteredEntries) {
    const existing = grouped.get(entry.sectionKey)
    if (existing) {
      existing.entries.push(entry)
      continue
    }

    grouped.set(entry.sectionKey, {
      key: entry.sectionKey,
      label: entry.sectionLabel,
      entries: [entry],
    })
  }

  return Array.from(grouped.values())
}
