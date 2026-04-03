import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions, type CurrentUserPermissions } from '@/lib/auth/permissions'
import {
  findLocalUnitByLegacyCouncilId,
  hasAreaAccess,
  listAccessibleLocalUnitsForArea,
  type ManagedAreaAccessLevel,
  type ManagedAreaCode,
} from '@/lib/auth/area-access'
import { isParallelAreaAccessEnabled } from '@/lib/auth/feature-flags'
import { hasEventManagementAccess } from '@/lib/auth/resource-access'
import {
  buildParallelAreaChooserHref,
  getSelectedLocalUnitIdForArea,
  PARALLEL_AREA_SELECTION_COOKIE,
  upsertSelectedLocalUnitId,
} from '@/lib/auth/parallel-area-selection'

export type ActingCouncilRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
}

export type ActingCouncilContext = {
  admin: ReturnType<typeof createAdminClient>
  permissions: CurrentUserPermissions
  council: ActingCouncilRow
  localUnitId: string | null
}

async function hasAreaAccessUsingCandidates(args: {
  admin: ReturnType<typeof createAdminClient>
  userId: string
  localUnitId: string
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}) {
  return hasAreaAccess({
    admin: args.admin,
    userId: args.userId,
    localUnitId: args.localUnitId,
    areaCode: args.areaCode,
    minimumAccessLevel: args.minimumAccessLevel,
  })
}

async function listAccessibleLocalUnitsUsingCandidates(args: {
  admin: ReturnType<typeof createAdminClient>
  userId: string
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}) {
  const accessibleLocalUnits = await listAccessibleLocalUnitsForArea({
    admin: args.admin,
    userId: args.userId,
    areaCode: args.areaCode,
    minimumAccessLevel: args.minimumAccessLevel,
  })

  return accessibleLocalUnits.map((unit) => ({
    local_unit_id: unit.local_unit_id,
    local_unit_name: unit.local_unit_name,
  }))
}

function applyParallelAreaPermissions(args: {
  permissions: CurrentUserPermissions
  council: ActingCouncilRow
  areaCode: ManagedAreaCode
}) {
  const nextPermissions: CurrentUserPermissions = {
    ...args.permissions,
    councilId: args.council.id,
    organizationId: args.council.organization_id ?? args.permissions.organizationId,
    hasStaffAccess: true,
  }

  if (args.areaCode === 'members') {
    return {
      ...nextPermissions,
      isCouncilAdmin: true,
      canAccessMemberData: true,
      canAccessOfficerDirectory: true,
      canReviewMemberChanges: true,
      canImportMembers: true,
    }
  }

  if (args.areaCode === 'events') {
    return {
      ...nextPermissions,
      canManageEvents: true,
    }
  }

  if (args.areaCode === 'custom_lists') {
    return {
      ...nextPermissions,
      canManageCustomLists: true,
    }
  }

  if (args.areaCode === 'local_unit_settings') {
    return {
      ...nextPermissions,
      canAccessOrganizationSettings: true,
    }
  }

  if (args.areaCode === 'claims') {
    return {
      ...nextPermissions,
      canReviewMemberChanges: true,
    }
  }

  if (args.areaCode === 'admins') {
    return {
      ...nextPermissions,
      canAccessOrganizationSettings: true,
      canManageAdmins: true,
    }
  }

  return nextPermissions
}

async function loadCouncilForLocalUnitMatch(args: {
  admin: ReturnType<typeof createAdminClient>
  match: { localUnitId: string; councilId: string }
}) {
  const { data: councilData } = await args.admin
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('id', args.match.councilId)
    .maybeSingle()

  const council = (councilData as ActingCouncilRow | null) ?? null
  if (!council) return null

  return {
    kind: 'resolved' as const,
    council,
    localUnitId: args.match.localUnitId,
  }
}

async function findCouncilForAccessArea(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: CurrentUserPermissions
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
  redirectTo?: string | null
}) {
  const { admin, permissions, areaCode, minimumAccessLevel } = args

  if (!permissions.authUser) return null

  const cookieStore = await cookies()
  const rawSelectionCookie = cookieStore.get(PARALLEL_AREA_SELECTION_COOKIE)?.value ?? null
  const storedLocalUnitId = getSelectedLocalUnitIdForArea({
    rawCookieValue: rawSelectionCookie,
    areaCode,
  })

  const accessibleLocalUnits = await listAccessibleLocalUnitsUsingCandidates({
    admin,
    userId: permissions.authUser.id,
    areaCode,
    minimumAccessLevel,
  })

  if (accessibleLocalUnits.length === 0) return null

  const candidateLocalUnits = accessibleLocalUnits.map((unit) => unit.local_unit_id)
  const { data: localUnitRows } = await admin
    .from('local_units')
    .select('id, legacy_council_id')
    .in('id', candidateLocalUnits)

  const legacyCouncilIds = ((localUnitRows ?? []) as Array<{ id: string; legacy_council_id: string | null }>)
    .map((row) => ({ localUnitId: row.id, councilId: row.legacy_council_id }))
    .filter((row): row is { localUnitId: string; councilId: string } => Boolean(row.councilId))

  if (legacyCouncilIds.length === 0) return null

  if (storedLocalUnitId) {
    const storedMatch = legacyCouncilIds.find((row) => row.localUnitId === storedLocalUnitId) ?? null
    if (storedMatch) {
      const resolvedStoredMatch = await loadCouncilForLocalUnitMatch({ admin, match: storedMatch })
      if (resolvedStoredMatch) return resolvedStoredMatch
    }

    cookieStore.set(
      PARALLEL_AREA_SELECTION_COOKIE,
      upsertSelectedLocalUnitId({
        rawCookieValue: rawSelectionCookie,
        areaCode,
        localUnitId: null,
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }
    )
  }

  if (permissions.councilId) {
    const currentLocalUnit = await findLocalUnitByLegacyCouncilId({ admin, councilId: permissions.councilId })
    if (currentLocalUnit?.id) {
      const currentContextHasAccess = await hasAreaAccessUsingCandidates({
        admin,
        userId: permissions.authUser.id,
        localUnitId: currentLocalUnit.id,
        areaCode,
        minimumAccessLevel,
      })

      if (currentContextHasAccess) {
        const currentMatch = legacyCouncilIds.find((row) => row.localUnitId === currentLocalUnit.id) ?? null
        if (currentMatch) {
          const resolvedCurrentMatch = await loadCouncilForLocalUnitMatch({ admin, match: currentMatch })
          if (resolvedCurrentMatch) return resolvedCurrentMatch
        }
      }
    }
  }

  if (legacyCouncilIds.length === 1) {
    return loadCouncilForLocalUnitMatch({ admin, match: legacyCouncilIds[0] })
  }

  return {
    kind: 'selection_required' as const,
    chooserHref: buildParallelAreaChooserHref({
      areaCode,
      minimumAccessLevel,
      nextPath: args.redirectTo ?? null,
    }),
  }
}

export async function findCurrentActingCouncilContextForArea(options: {
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}) {
  const permissions = await getCurrentUserPermissions()
  const admin = createAdminClient()

  if (!permissions.authUser) return null

  if (!isParallelAreaAccessEnabled({
    areaCode: options.areaCode,
    minimumAccessLevel: options.minimumAccessLevel,
  })) {
    return null
  }

  const match = await findCouncilForAccessArea({
    admin,
    permissions,
    areaCode: options.areaCode,
    minimumAccessLevel: options.minimumAccessLevel,
  })

  if (!match || match.kind !== 'resolved') return null

  return {
    admin,
    permissions: applyParallelAreaPermissions({
      permissions,
      council: match.council,
      areaCode: options.areaCode,
    }),
    council: match.council,
    localUnitId: match.localUnitId,
  } satisfies ActingCouncilContext
}

export async function getCurrentActingCouncilContext(options?: {
  requireAdmin?: boolean
  redirectTo?: string
  areaCode?: ManagedAreaCode
  minimumAccessLevel?: ManagedAreaAccessLevel
}): Promise<ActingCouncilContext> {
  const requireAdmin = options?.requireAdmin ?? false
  const redirectTo = options?.redirectTo ?? '/me'
  const permissions = await getCurrentUserPermissions()
  const admin = createAdminClient()

  if (!permissions.authUser) redirect('/login')

  const areaCode = options?.areaCode
  const minimumAccessLevel = options?.minimumAccessLevel
  const shouldUseParallelAreaAccess = Boolean(
    areaCode &&
      minimumAccessLevel &&
      isParallelAreaAccessEnabled({
        areaCode,
        minimumAccessLevel,
      })
  )

  if (shouldUseParallelAreaAccess && areaCode && minimumAccessLevel) {
    const match = await findCouncilForAccessArea({
      admin,
      permissions,
      areaCode,
      minimumAccessLevel,
      redirectTo,
    })

    if (!match) redirect(redirectTo)
    if (match.kind === 'selection_required') redirect(match.chooserHref)

    return {
      admin,
      permissions: applyParallelAreaPermissions({
        permissions,
        council: match.council,
        areaCode,
      }),
      council: match.council,
      localUnitId: match.localUnitId,
    }
  }

  const fallbackCouncilId =
    permissions.councilId ?? permissions.availableContexts.find((context) => context.councilId)?.councilId ?? null

  if (!fallbackCouncilId || !permissions.hasStaffAccess) redirect(redirectTo)
  if (requireAdmin && !permissions.hasStaffAccess) redirect('/me')

  const { data: councilData } = await admin
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('id', fallbackCouncilId)
    .maybeSingle()

  const council = (councilData as ActingCouncilRow | null) ?? null
  if (!council) redirect(redirectTo)

  const resolvedCouncil = council as ActingCouncilRow
  const currentLocalUnit = await findLocalUnitByLegacyCouncilId({ admin, councilId: resolvedCouncil.id })

  return { admin, permissions, council: resolvedCouncil, localUnitId: currentLocalUnit?.id ?? null }
}

export const requireActingCouncilContext = getCurrentActingCouncilContext


export async function getCurrentActingCouncilContextForEvent(options: {
  eventId: string
  redirectTo?: string
}): Promise<ActingCouncilContext> {
  const redirectTo = options.redirectTo ?? '/events'
  const permissions = await getCurrentUserPermissions()
  const admin = createAdminClient()

  if (!permissions.authUser) redirect('/login')

  const { data: eventData } = await admin
    .from('events')
    .select('id, council_id, local_unit_id')
    .eq('id', options.eventId)
    .maybeSingle<{ id: string; council_id: string; local_unit_id: string | null }>()

  const event = eventData ?? null

  if (
    event?.local_unit_id &&
    isParallelAreaAccessEnabled({ areaCode: 'events', minimumAccessLevel: 'manage' }) &&
    permissions.authUser &&
    await hasEventManagementAccess({
      admin,
      userId: permissions.authUser.id,
      localUnitId: event.local_unit_id,
      eventId: event.id,
    })
  ) {
    const { data: councilData } = await admin
      .from('councils')
      .select('id, name, council_number, organization_id')
      .eq('id', event.council_id)
      .maybeSingle()

    const council = (councilData as ActingCouncilRow | null) ?? null
    if (council) {
      return {
        admin,
        permissions: applyParallelAreaPermissions({
          permissions,
          council,
          areaCode: 'events',
        }),
        council,
        localUnitId: event.local_unit_id,
      }
    }
  }

  return getCurrentActingCouncilContext({
    redirectTo,
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })
}
