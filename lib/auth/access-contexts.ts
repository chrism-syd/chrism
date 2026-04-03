import { cookies } from 'next/headers'

export const ACTIVE_ACCESS_CONTEXT_COOKIE = 'chrism_active_access_context'

export type CurrentUserAccessContext = {
  key: string
  shortLabel: string
  fullLabel: string
  accessLevel: 'member' | 'staff'
  organizationId: string | null
  organizationName: string | null
  councilId: string | null
  localUnitId: string | null
}

type PermissionsLike = {
  isOrganizationMember?: boolean
  personId?: string | null
  organizationId?: string | null
  organizationName?: string | null
  councilId?: string | null
  hasStaffAccess?: boolean
}

type ParallelAccessLike = {
  organization_id: string | null
  local_unit_id: string | null
  local_unit_name: string | null
  can_manage_members: boolean | null
  can_manage_events: boolean | null
  can_manage_custom_lists: boolean | null
  can_manage_claims: boolean | null
  can_manage_admins: boolean | null
  can_manage_local_unit_settings: boolean | null
}

function hasStaffPrivileges(row: ParallelAccessLike) {
  return Boolean(
    row.can_manage_members ||
      row.can_manage_events ||
      row.can_manage_custom_lists ||
      row.can_manage_claims ||
      row.can_manage_admins ||
      row.can_manage_local_unit_settings
  )
}

function makeMemberContext(permissions: PermissionsLike): CurrentUserAccessContext | null {
  if (!permissions.isOrganizationMember && !permissions.personId) {
    return null
  }

  const organizationId = permissions.organizationId ?? null
  const organizationName = permissions.organizationName ?? null
  const councilId = permissions.councilId ?? null

  return {
    key: `member:${organizationId ?? councilId ?? 'self'}`,
    shortLabel: 'Spiritual',
    fullLabel: organizationName
      ? `${organizationName} spiritual view`
      : 'Spiritual view',
    accessLevel: 'member',
    organizationId,
    organizationName,
    councilId,
    localUnitId: null,
  }
}

function makeStaffContexts(args: {
  permissions: PermissionsLike
  rows: ParallelAccessLike[]
}): CurrentUserAccessContext[] {
  const { permissions, rows } = args
  const contexts = new Map<string, CurrentUserAccessContext>()

  for (const row of rows) {
    if (!hasStaffPrivileges(row)) continue

    const organizationId = row.organization_id ?? permissions.organizationId ?? null
    const organizationName =
      row.organization_id && row.organization_id === permissions.organizationId
        ? permissions.organizationName ?? row.local_unit_name ?? null
        : row.local_unit_name ?? permissions.organizationName ?? null

    const key = `staff:${organizationId ?? 'org'}:${row.local_unit_id ?? 'unit'}`
    if (contexts.has(key)) continue

    contexts.set(key, {
      key,
      shortLabel: row.local_unit_name?.trim() || organizationName || 'Organization',
      fullLabel:
        row.local_unit_name?.trim() || organizationName
          ? `${row.local_unit_name?.trim() || organizationName} admin view`
          : 'Organization admin view',
      accessLevel: 'staff',
      organizationId,
      organizationName,
      councilId:
        organizationId && organizationId === permissions.organizationId
          ? permissions.councilId ?? null
          : null,
      localUnitId: row.local_unit_id ?? null,
    })
  }

  if (contexts.size === 0 && permissions.hasStaffAccess) {
    const organizationId = permissions.organizationId ?? null
    const organizationName = permissions.organizationName ?? null
    const councilId = permissions.councilId ?? null
    const key = `staff:${organizationId ?? councilId ?? 'default'}:default`

    contexts.set(key, {
      key,
      shortLabel: organizationName || 'Organization',
      fullLabel: organizationName ? `${organizationName} admin view` : 'Organization admin view',
      accessLevel: 'staff',
      organizationId,
      organizationName,
      councilId,
      localUnitId: null,
    })
  }

  return [...contexts.values()]
}

export function buildAvailableAccessContexts(args: {
  permissions: PermissionsLike
  rows: ParallelAccessLike[]
}): CurrentUserAccessContext[] {
  const memberContext = makeMemberContext(args.permissions)
  const staffContexts = makeStaffContexts(args)

  return memberContext ? [memberContext, ...staffContexts] : staffContexts
}

export function getDefaultAccessContext(args: {
  contexts: CurrentUserAccessContext[]
  preferredKey?: string | null
}): CurrentUserAccessContext | null {
  const { contexts, preferredKey } = args

  if (preferredKey) {
    const preferred = contexts.find((context) => context.key === preferredKey)
    if (preferred) return preferred
  }

  return contexts[0] ?? null
}

export async function getStoredAccessContextKey() {
  const cookieStore = await cookies()
  return cookieStore.get(ACTIVE_ACCESS_CONTEXT_COOKIE)?.value ?? null
}

export async function setStoredAccessContextKey(contextKey: string | null) {
  const cookieStore = await cookies()

  if (!contextKey) {
    cookieStore.delete(ACTIVE_ACCESS_CONTEXT_COOKIE)
    return
  }

  cookieStore.set(ACTIVE_ACCESS_CONTEXT_COOKIE, contextKey, {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  })
}

export async function getCurrentAreaContextCookieValues() {
  return {
    currentAccessContextKey: await getStoredAccessContextKey(),
  }
}
