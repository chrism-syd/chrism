import { redirect } from 'next/navigation'
import type { CurrentUserPermissions } from '@/lib/auth/permissions'
import type { SupabaseAdminClient } from '@/lib/supabase/admin'
import {
  authHasAreaAccess,
  authHasEventManagementAccess,
  resolveOrganizationLocalUnitMap,
} from '@/lib/auth/area-access'

export type ActingCouncilContext = {
  council: {
    id: string
    name: string
    council_number: string | null
  }
  organization: {
    id: string | null
    display_name: string | null
    preferred_name: string | null
  } | null
  localUnitId: string | null
}

type ResolveActingCouncilContextArgs = {
  permissions: CurrentUserPermissions
  supabaseAdmin: SupabaseAdminClient
  redirectTo?: string
  requireAdmin?: boolean
  requireArea?: {
    area: 'members' | 'events' | 'custom_lists' | 'claims' | 'admins' | 'local_unit_settings'
    level: 'read_only' | 'edit_manage' | 'manage'
  }
}

type CouncilRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
  organizations:
    | {
        display_name: string | null
        preferred_name: string | null
      }
    | Array<{
        display_name: string | null
        preferred_name: string | null
      }>
    | null
}

function firstOrganization(
  organization:
    | CouncilRow['organizations']
    | null
): {
  display_name: string | null
  preferred_name: string | null
} | null {
  if (!organization) return null
  return Array.isArray(organization) ? organization[0] ?? null : organization
}

async function resolveCouncilById(args: {
  supabaseAdmin: SupabaseAdminClient
  councilId: string
}): Promise<ActingCouncilContext | null> {
  const { supabaseAdmin, councilId } = args
  const { data, error } = await supabaseAdmin
    .from('councils')
    .select('id, name, council_number, organization_id, organizations(display_name, preferred_name)')
    .eq('id', councilId)
    .maybeSingle<CouncilRow>()

  if (error || !data) return null

  const organization = firstOrganization(data.organizations)

  return {
    council: {
      id: data.id,
      name: data.name ?? 'Council',
      council_number: data.council_number,
    },
    organization: data.organization_id
      ? {
          id: data.organization_id,
          display_name: organization?.display_name ?? null,
          preferred_name: organization?.preferred_name ?? null,
        }
      : null,
    localUnitId: null,
  }
}

async function resolveDefaultAccessibleCouncil(args: {
  permissions: CurrentUserPermissions
  supabaseAdmin: SupabaseAdminClient
}): Promise<ActingCouncilContext | null> {
  const { permissions, supabaseAdmin } = args
  const availableContexts = permissions.availableContexts ?? []
  const firstStaffContext = availableContexts.find((context) => context.accessLevel !== 'member')
  if (firstStaffContext?.councilId) {
    const context = await resolveCouncilById({
      supabaseAdmin,
      councilId: firstStaffContext.councilId,
    })
    if (context) return context
  }

  if (permissions.councilId) {
    const context = await resolveCouncilById({
      supabaseAdmin,
      councilId: permissions.councilId,
    })
    if (context) return context
  }

  if (permissions.organizationId) {
    const localUnitMap = await resolveOrganizationLocalUnitMap({
      admin: supabaseAdmin,
      organizationIds: [permissions.organizationId],
    })
    const defaultLocalUnitId = localUnitMap.get(permissions.organizationId) ?? null
    if (!defaultLocalUnitId) return null

    const { data: defaultCouncil, error: defaultCouncilError } = await supabaseAdmin
      .from('local_units')
      .select('legacy_council_id')
      .eq('id', defaultLocalUnitId)
      .maybeSingle<{ legacy_council_id: string | null }>()

    if (!defaultCouncilError && defaultCouncil?.legacy_council_id) {
      const context = await resolveCouncilById({
        supabaseAdmin,
        councilId: defaultCouncil.legacy_council_id,
      })
      if (context) {
        return {
          ...context,
          localUnitId: defaultLocalUnitId,
        }
      }
    }
  }

  return null
}

export async function getCurrentActingCouncilContext(
  args: ResolveActingCouncilContextArgs
): Promise<ActingCouncilContext> {
  const {
    permissions,
    supabaseAdmin,
    redirectTo = '/',
    requireAdmin = true,
    requireArea,
  } = args

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const resolved = await resolveDefaultAccessibleCouncil({
    permissions,
    supabaseAdmin,
  })

  if (!resolved) {
    if (requireAdmin || requireArea) {
      redirect(redirectTo)
    }

    return {
      council: {
        id: '',
        name: 'Council',
        council_number: null,
      },
      organization: permissions.organizationId
        ? {
            id: permissions.organizationId,
            display_name: permissions.organizationName,
            preferred_name: permissions.organizationName,
          }
        : null,
      localUnitId: null,
    }
  }

  let localUnitId = resolved.localUnitId
  if (!localUnitId && resolved.organization?.id) {
    const localUnitMap = await resolveOrganizationLocalUnitMap({
      admin: supabaseAdmin,
      organizationIds: [resolved.organization.id],
    })
    localUnitId = localUnitMap.get(resolved.organization.id) ?? null
  }

  if (requireArea) {
    let hasAreaAccess = false

    if (localUnitId) {
      hasAreaAccess = await authHasAreaAccess({
        admin: supabaseAdmin,
        userId: permissions.authUser?.id ?? null,
        localUnitId,
        area: requireArea.area,
        level: requireArea.level,
      })
    }

    if (!hasAreaAccess && requireArea.area === 'events') {
      hasAreaAccess = permissions.canManageEvents || permissions.hasStaffAccess
    }

    if (!hasAreaAccess && requireArea.area === 'members') {
      hasAreaAccess = permissions.canAccessMemberData || permissions.hasStaffAccess
    }

    if (!hasAreaAccess && requireArea.area === 'custom_lists') {
      hasAreaAccess = permissions.canManageCustomLists || permissions.hasStaffAccess
    }

    if (!hasAreaAccess && requireArea.area === 'claims') {
      hasAreaAccess = permissions.canReviewClaims || permissions.hasStaffAccess
    }

    if (!hasAreaAccess && requireArea.area === 'admins') {
      hasAreaAccess = permissions.canManageAdmins || permissions.hasStaffAccess
    }

    if (!hasAreaAccess && requireArea.area === 'local_unit_settings') {
      hasAreaAccess = permissions.canAccessOrganizationSettings || permissions.hasStaffAccess
    }

    if (!hasAreaAccess) {
      redirect(redirectTo)
    }
  } else if (requireAdmin) {
    const hasDefaultAdminAccess = permissions.hasStaffAccess || permissions.isCouncilAdmin
    let hasAreaBackedAccess = false

    if (localUnitId) {
      const [membersAccess, eventsAccess, adminsAccess, settingsAccess, eventManageAccess] = await Promise.all([
        authHasAreaAccess({
          admin: supabaseAdmin,
          userId: permissions.authUser?.id ?? null,
          localUnitId,
          area: 'members',
          level: 'edit_manage',
        }),
        authHasAreaAccess({
          admin: supabaseAdmin,
          userId: permissions.authUser?.id ?? null,
          localUnitId,
          area: 'events',
          level: 'manage',
        }),
        authHasAreaAccess({
          admin: supabaseAdmin,
          userId: permissions.authUser?.id ?? null,
          localUnitId,
          area: 'admins',
          level: 'manage',
        }),
        authHasAreaAccess({
          admin: supabaseAdmin,
          userId: permissions.authUser?.id ?? null,
          localUnitId,
          area: 'local_unit_settings',
          level: 'manage',
        }),
        authHasEventManagementAccess({
          admin: supabaseAdmin,
          userId: permissions.authUser?.id ?? null,
          localUnitId,
        }),
      ])

      hasAreaBackedAccess =
        membersAccess || eventsAccess || adminsAccess || settingsAccess || eventManageAccess
    }

    if (!hasDefaultAdminAccess && !hasAreaBackedAccess) {
      redirect(redirectTo)
    }
  }

  return {
    ...resolved,
    localUnitId,
  }
}
