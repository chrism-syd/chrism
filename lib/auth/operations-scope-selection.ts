import type { ManagedAreaAccessLevel, ManagedAreaCode } from '@/lib/auth/area-access'

export const OPERATIONS_SCOPE_COOKIE = 'chrism_parallel_area_selection'
export const SHARED_OPERATIONS_LOCAL_UNIT_KEY = 'operations'

type OperationsScopeSelectionMap = Partial<Record<ManagedAreaCode | typeof SHARED_OPERATIONS_LOCAL_UNIT_KEY, string>>

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

export function parseOperationsScopeCookie(rawValue?: string | null): OperationsScopeSelectionMap {
  if (!rawValue) return {}

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>
    const allowedAreas = new Set<ManagedAreaCode | typeof SHARED_OPERATIONS_LOCAL_UNIT_KEY>([
      'members',
      'events',
      'custom_lists',
      'claims',
      'admins',
      'local_unit_settings',
      SHARED_OPERATIONS_LOCAL_UNIT_KEY,
    ])

    const nextSelections: OperationsScopeSelectionMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!allowedAreas.has(key as ManagedAreaCode | typeof SHARED_OPERATIONS_LOCAL_UNIT_KEY)) continue
      const localUnitId = clean(typeof value === 'string' ? value : null)
      if (localUnitId) {
        nextSelections[key as ManagedAreaCode | typeof SHARED_OPERATIONS_LOCAL_UNIT_KEY] = localUnitId
      }
    }

    return nextSelections
  } catch {
    return {}
  }
}

export function serializeOperationsScopeCookie(value: OperationsScopeSelectionMap) {
  return JSON.stringify(value)
}

export function getSelectedOperationsLocalUnitId(args: { rawCookieValue?: string | null }) {
  const parsed = parseOperationsScopeCookie(args.rawCookieValue)
  return parsed[SHARED_OPERATIONS_LOCAL_UNIT_KEY] ?? null
}

export function getSelectedLocalUnitIdForArea(args: {
  rawCookieValue?: string | null
  areaCode: ManagedAreaCode
}) {
  const parsed = parseOperationsScopeCookie(args.rawCookieValue)
  return parsed[SHARED_OPERATIONS_LOCAL_UNIT_KEY] ?? parsed[args.areaCode] ?? null
}

export function setSelectedOperationsLocalUnitId(args: {
  rawCookieValue?: string | null
  localUnitId: string | null
}) {
  const currentSelections = parseOperationsScopeCookie(args.rawCookieValue)

  if (args.localUnitId) {
    currentSelections[SHARED_OPERATIONS_LOCAL_UNIT_KEY] = args.localUnitId
  } else {
    delete currentSelections[SHARED_OPERATIONS_LOCAL_UNIT_KEY]
  }

  return serializeOperationsScopeCookie(currentSelections)
}

export function buildAreaScopeChooserHref(args: {
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
