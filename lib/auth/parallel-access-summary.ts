import { cookies } from 'next/headers'
import type { CurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  findLocalUnitByLegacyCouncilId,
  findLocalUnitByLegacyOrganizationId,
  hasAreaAccess,
  listAccessibleLocalUnitsForArea,
} from '@/lib/auth/area-access'
import { isParallelAreaAccessEnabled } from '@/lib/auth/feature-flags'
import {
  getSelectedOperationsLocalUnitId,
  OPERATIONS_SCOPE_COOKIE,
} from '@/lib/auth/operations-scope-selection'

async function countAreaUnits(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: CurrentUserPermissions
  areaCode: Parameters<typeof listAccessibleLocalUnitsForArea>[0]['areaCode']
  minimumAccessLevel: Parameters<typeof listAccessibleLocalUnitsForArea>[0]['minimumAccessLevel']
}) {
  if (!args.permissions.authUser) return 0
  if (!isParallelAreaAccessEnabled({ areaCode: args.areaCode, minimumAccessLevel: args.minimumAccessLevel })) {
    return 0
  }

  const units = await listAccessibleLocalUnitsForArea({
    admin: args.admin,
    userId: args.permissions.authUser.id,
    areaCode: args.areaCode,
    minimumAccessLevel: args.minimumAccessLevel,
  })

  return units.length
}

async function resolveSelectedOperationsLocalUnitId() {
  const cookieStore = await cookies()
  return getSelectedOperationsLocalUnitId({
    rawCookieValue: cookieStore.get(OPERATIONS_SCOPE_COOKIE)?.value ?? null,
  })
}

async function resolveActiveLocalUnitId(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: CurrentUserPermissions
}) {
  const { admin, permissions } = args

  if (permissions.activeLocalUnitId) {
    return permissions.activeLocalUnitId
  }

  const selectedOperationsLocalUnitId = await resolveSelectedOperationsLocalUnitId()
  if (selectedOperationsLocalUnitId) {
    return selectedOperationsLocalUnitId
  }

  if (permissions.councilId) {
    const row = await findLocalUnitByLegacyCouncilId({
      admin,
      councilId: permissions.councilId,
    })
    if (row?.id) return row.id
  }

  if (permissions.organizationId) {
    const row = await findLocalUnitByLegacyOrganizationId({
      admin,
      organizationId: permissions.organizationId,
    })
    if (row?.id) return row.id
  }

  return null
}

async function hasScopedAreaAccess(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: CurrentUserPermissions
  localUnitId: string | null
  areaCode: Parameters<typeof listAccessibleLocalUnitsForArea>[0]['areaCode']
  minimumAccessLevel: Parameters<typeof listAccessibleLocalUnitsForArea>[0]['minimumAccessLevel']
}) {
  if (!args.permissions.authUser || !args.localUnitId) return false
  if (!isParallelAreaAccessEnabled({ areaCode: args.areaCode, minimumAccessLevel: args.minimumAccessLevel })) {
    return false
  }

  return hasAreaAccess({
    admin: args.admin,
    userId: args.permissions.authUser.id,
    localUnitId: args.localUnitId,
    areaCode: args.areaCode,
    minimumAccessLevel: args.minimumAccessLevel,
  })
}

export async function getParallelAreaAccessSummary(args: {
  admin?: ReturnType<typeof createAdminClient>
  permissions: CurrentUserPermissions
}) {
  const admin = args.admin ?? createAdminClient()
  const permissions = args.permissions
  const activeLocalUnitId = await resolveActiveLocalUnitId({ admin, permissions })

  const [
    membersManageCount,
    eventsManageCount,
    customListsManageCount,
    claimsManageCount,
    adminsManageCount,
    localUnitSettingsManageCount,
    membersManageActive,
    eventsManageActive,
    customListsManageActive,
    claimsManageActive,
    adminsManageActive,
    localUnitSettingsManageActive,
  ] = await Promise.all([
    countAreaUnits({ admin, permissions, areaCode: 'members', minimumAccessLevel: 'edit_manage' }),
    countAreaUnits({ admin, permissions, areaCode: 'events', minimumAccessLevel: 'manage' }),
    countAreaUnits({ admin, permissions, areaCode: 'custom_lists', minimumAccessLevel: 'manage' }),
    countAreaUnits({ admin, permissions, areaCode: 'claims', minimumAccessLevel: 'manage' }),
    countAreaUnits({ admin, permissions, areaCode: 'admins', minimumAccessLevel: 'manage' }),
    countAreaUnits({ admin, permissions, areaCode: 'local_unit_settings', minimumAccessLevel: 'manage' }),
    hasScopedAreaAccess({ admin, permissions, localUnitId: activeLocalUnitId, areaCode: 'members', minimumAccessLevel: 'edit_manage' }),
    hasScopedAreaAccess({ admin, permissions, localUnitId: activeLocalUnitId, areaCode: 'events', minimumAccessLevel: 'manage' }),
    hasScopedAreaAccess({ admin, permissions, localUnitId: activeLocalUnitId, areaCode: 'custom_lists', minimumAccessLevel: 'manage' }),
    hasScopedAreaAccess({ admin, permissions, localUnitId: activeLocalUnitId, areaCode: 'claims', minimumAccessLevel: 'manage' }),
    hasScopedAreaAccess({ admin, permissions, localUnitId: activeLocalUnitId, areaCode: 'admins', minimumAccessLevel: 'manage' }),
    hasScopedAreaAccess({ admin, permissions, localUnitId: activeLocalUnitId, areaCode: 'local_unit_settings', minimumAccessLevel: 'manage' }),
  ])

  return {
    activeLocalUnitId,
    membersManage: membersManageCount > 0,
    membersManageCount,
    membersManageActive,
    eventsManage: eventsManageCount > 0,
    eventsManageCount,
    eventsManageActive,
    customListsManage: customListsManageCount > 0,
    customListsManageCount,
    customListsManageActive,
    claimsManage: claimsManageCount > 0,
    claimsManageCount,
    claimsManageActive,
    adminsManage: adminsManageCount > 0,
    adminsManageCount,
    adminsManageActive,
    localUnitSettingsManage: localUnitSettingsManageCount > 0,
    localUnitSettingsManageCount,
    localUnitSettingsManageActive,
  }
}
