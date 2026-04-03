import type { ManagedAreaAccessLevel, ManagedAreaCode } from '@/lib/auth/area-access'

export const PARALLEL_AREA_SELECTION_COOKIE = 'chrism_parallel_area_selection'

type ParallelAreaSelectionMap = Partial<Record<ManagedAreaCode, string>>

type AreaPathMatch = {
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
  areaLabel: string
}

const AREA_LABELS: Record<ManagedAreaCode, string> = {
  members: 'Members',
  events: 'Events',
  custom_lists: 'Custom lists',
  claims: 'Claims',
  admins: 'Admins',
  local_unit_settings: 'Organization settings',
}

function clean(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function getManagedAreaLabel(areaCode: ManagedAreaCode) {
  return AREA_LABELS[areaCode]
}

export function parseParallelAreaSelectionCookie(rawValue?: string | null): ParallelAreaSelectionMap {
  if (!rawValue) return {}

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>
    const allowedAreas = new Set<ManagedAreaCode>([
      'members',
      'events',
      'custom_lists',
      'claims',
      'admins',
      'local_unit_settings',
    ])

    const nextSelections: ParallelAreaSelectionMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!allowedAreas.has(key as ManagedAreaCode)) continue
      const localUnitId = clean(typeof value === 'string' ? value : null)
      if (localUnitId) nextSelections[key as ManagedAreaCode] = localUnitId
    }

    return nextSelections
  } catch {
    return {}
  }
}

export function serializeParallelAreaSelectionCookie(value: ParallelAreaSelectionMap) {
  return JSON.stringify(value)
}

export function getSelectedLocalUnitIdForArea(args: {
  rawCookieValue?: string | null
  areaCode: ManagedAreaCode
}) {
  return parseParallelAreaSelectionCookie(args.rawCookieValue)[args.areaCode] ?? null
}

export function upsertSelectedLocalUnitId(args: {
  rawCookieValue?: string | null
  areaCode: ManagedAreaCode
  localUnitId: string | null
}) {
  const currentSelections = parseParallelAreaSelectionCookie(args.rawCookieValue)

  if (args.localUnitId) {
    currentSelections[args.areaCode] = args.localUnitId
  } else {
    delete currentSelections[args.areaCode]
  }

  return serializeParallelAreaSelectionCookie(currentSelections)
}

export function buildParallelAreaChooserHref(args: {
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
  nextPath?: string | null
}) {
  const searchParams = new URLSearchParams({
    area: args.areaCode,
    level: args.minimumAccessLevel,
  })

  const nextPath = clean(args.nextPath)
  if (nextPath) searchParams.set('next', nextPath)

  return `/access/select?${searchParams.toString()}`
}

export function inferAreaSelectionFromPath(pathname: string | null | undefined): AreaPathMatch | null {
  const path = clean(pathname)
  if (!path) return null

  if (path === '/members' || path.startsWith('/members/')) {
    return {
      areaCode: 'members',
      minimumAccessLevel: 'edit_manage',
      areaLabel: getManagedAreaLabel('members'),
    }
  }

  if (path === '/events' || path.startsWith('/events/')) {
    return {
      areaCode: 'events',
      minimumAccessLevel: 'manage',
      areaLabel: getManagedAreaLabel('events'),
    }
  }

  if (path === '/custom-lists' || path.startsWith('/custom-lists/')) {
    return {
      areaCode: 'custom_lists',
      minimumAccessLevel: 'interact',
      areaLabel: getManagedAreaLabel('custom_lists'),
    }
  }

  if (path === '/me/council' || path.startsWith('/me/council/')) {
    return {
      areaCode: 'local_unit_settings',
      minimumAccessLevel: 'manage',
      areaLabel: getManagedAreaLabel('local_unit_settings'),
    }
  }

  if (path === '/imports/supreme' || path.startsWith('/imports/supreme/')) {
    return {
      areaCode: 'members',
      minimumAccessLevel: 'edit_manage',
      areaLabel: getManagedAreaLabel('members'),
    }
  }

  return null
}
