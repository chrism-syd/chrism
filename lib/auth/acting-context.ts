import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions, type CurrentUserPermissions } from '@/lib/auth/permissions'
import {
  findLocalUnitByLegacyCouncilId,
  listAccessibleLocalUnitsForArea,
  type ManagedAreaAccessLevel,
  type ManagedAreaCode,
} from '@/lib/auth/area-access'
import {
  getSelectedLocalUnitIdForArea,
  OPERATIONS_SCOPE_COOKIE,
} from '@/lib/auth/operations-scope-selection'

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

function getFallbackCouncilId(permissions: CurrentUserPermissions) {
  return (
    permissions.councilId ??
    permissions.availableContexts.find((context) => context.councilId)?.councilId ??
    null
  )
}

function hasAreaPermission(args: {
  permissions: CurrentUserPermissions
  areaCode?: ManagedAreaCode
}) {
  const { permissions, areaCode } = args

  if (!areaCode) return permissions.hasStaffAccess
  if (areaCode === 'events') return permissions.canManageEvents || permissions.hasStaffAccess
  if (areaCode === 'members') return permissions.canAccessMemberData || permissions.hasStaffAccess
  if (areaCode === 'custom_lists') return permissions.canManageCustomLists || permissions.hasStaffAccess
  if (areaCode === 'claims') return permissions.canReviewClaims || permissions.canReviewMemberChanges || permissions.hasStaffAccess
  if (areaCode === 'admins') return permissions.canManageAdmins || permissions.hasStaffAccess
  if (areaCode === 'local_unit_settings') return permissions.canAccessOrganizationSettings || permissions.hasStaffAccess
  return permissions.hasStaffAccess
}

async function loadCouncilById(args: {
  admin: ReturnType<typeof createAdminClient>
  councilId: string
}) {
  const { data } = await args.admin
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('id', args.councilId)
    .maybeSingle()

  return (data as ActingCouncilRow | null) ?? null
}

async function buildContextFromCouncil(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: CurrentUserPermissions
  councilId: string
  patchPermissions?: Partial<CurrentUserPermissions>
}) {
  const council = await loadCouncilById({
    admin: args.admin,
    councilId: args.councilId,
  })

  if (!council) return null

  const currentLocalUnit = await findLocalUnitByLegacyCouncilId({
    admin: args.admin,
    councilId: council.id,
  }).catch(() => null)

  return {
    admin: args.admin,
    permissions: {
      ...args.permissions,
      ...args.patchPermissions,
      councilId: council.id,
      organizationId: council.organization_id ?? args.permissions.organizationId,
    },
    council,
    localUnitId: currentLocalUnit?.id ?? null,
  } satisfies ActingCouncilContext
}

async function resolveScopedCouncilId(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: CurrentUserPermissions
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}) {
  const { admin, permissions, areaCode, minimumAccessLevel } = args

  if (!permissions.authUser) {
    return getFallbackCouncilId(permissions)
  }

  const cookieStore = await cookies()
  const selectedLocalUnitId = getSelectedLocalUnitIdForArea({
    rawCookieValue: cookieStore.get(OPERATIONS_SCOPE_COOKIE)?.value ?? null,
    areaCode,
  })

  if (selectedLocalUnitId) {
    try {
      const accessibleLocalUnits = await listAccessibleLocalUnitsForArea({
        admin,
        userId: permissions.authUser.id,
        areaCode,
        minimumAccessLevel,
      })

      const isAllowedSelection = accessibleLocalUnits.some(
        (unit) => unit.local_unit_id === selectedLocalUnitId
      )

      if (isAllowedSelection) {
        const { data } = await admin
          .from('local_units')
          .select('legacy_council_id')
          .eq('id', selectedLocalUnitId)
          .maybeSingle<{ legacy_council_id: string | null }>()

        const selectedCouncilId = data?.legacy_council_id ?? null
        if (selectedCouncilId) {
          return selectedCouncilId
        }
      }
    } catch {
      // Fall back to the global active context below.
    }
  }

  return getFallbackCouncilId(permissions)
}

export async function findCurrentActingCouncilContextForArea(options: {
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}) {
  const permissions = await getCurrentUserPermissions()
  const admin = createAdminClient()

  if (!permissions.authUser) return null
  if (!hasAreaPermission({ permissions, areaCode: options.areaCode })) return null

  const councilId = await resolveScopedCouncilId({
    admin,
    permissions,
    areaCode: options.areaCode,
    minimumAccessLevel: options.minimumAccessLevel,
  })

  if (!councilId) return null

  return buildContextFromCouncil({
    admin,
    permissions,
    councilId,
  })
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
  if (requireAdmin && !permissions.hasStaffAccess) redirect('/me')
  if (!hasAreaPermission({ permissions, areaCode: options?.areaCode })) redirect(redirectTo)

  const councilId =
    options?.areaCode && options?.minimumAccessLevel
      ? await resolveScopedCouncilId({
          admin,
          permissions,
          areaCode: options.areaCode,
          minimumAccessLevel: options.minimumAccessLevel,
        })
      : getFallbackCouncilId(permissions)

  if (!councilId) redirect(redirectTo)

  const context = await buildContextFromCouncil({
    admin,
    permissions,
    councilId,
  })

  if (!context) redirect(redirectTo)
  return context
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
  if (!(permissions.canManageEvents || permissions.hasStaffAccess)) redirect(redirectTo)

  const { data: eventData } = await admin
    .from('events')
    .select('id, council_id')
    .eq('id', options.eventId)
    .maybeSingle<{ id: string; council_id: string }>()

  const event = eventData ?? null
  const canUseEventCouncil = Boolean(
    event?.council_id &&
      (
        event.council_id === permissions.councilId ||
        permissions.availableContexts.some((context) => context.councilId === event.council_id)
      )
  )

  if (event?.council_id && canUseEventCouncil) {
    const eventContext = await buildContextFromCouncil({
      admin,
      permissions,
      councilId: event.council_id,
      patchPermissions: {
        hasStaffAccess: true,
        canManageEvents: true,
      },
    })

    if (eventContext) {
      return eventContext
    }
  }

  return getCurrentActingCouncilContext({
    redirectTo,
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })
}
