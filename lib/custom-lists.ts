import type { SupabaseClient } from '@supabase/supabase-js'
import type { CurrentUserPermissions } from '@/lib/auth/permissions'
import { findLocalUnitByLegacyCouncilId, hasAreaAccess } from '@/lib/auth/area-access'
import { hasResourceAccess, listAccessibleCustomListIdsForUser } from '@/lib/auth/resource-access'
import { decryptPeopleRecords } from '@/lib/security/pii'

export type CustomListRow = {
  id: string
  council_id: string | null
  local_unit_id: string | null
  name: string
  description: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  created_by_auth_user_id: string | null
  updated_by_auth_user_id: string | null
}

export type CustomListMemberRow = {
  id: string
  custom_list_id: string
  person_id: string
  claimed_by_person_id: string | null
  claimed_at: string | null
  last_contact_at: string | null
  last_contact_by_person_id: string | null
  added_at: string
}

export type CustomListAccessRow = {
  id: string
  custom_list_id: string
  person_id: string | null
  user_id: string | null
  grantee_email: string | null
  granted_at: string
  granted_by_auth_user_id: string | null
}

export type CustomListShareGrantRow = {
  id: string
  custom_list_id: string
  person_id: string | null
  user_id: string | null
  grantee_email: string | null
  granted_at: string
  granted_by_auth_user_id: string | null
}

type EffectiveResourceAccessRow = {
  resource_access_grant_id: string
  resource_key: string
  person_id: string | null
  user_id: string | null
  granted_at: string | null
}

export type CustomListPersonSummaryRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  cell_phone: string | null
  home_phone: string | null
}

export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null
}

export function buildCustomListAccessMatch(permissions: CurrentUserPermissions) {
  if (permissions.isDevMode) {
    return null
  }

  const parts = [
    permissions.authUser?.id ? `user_id.eq.${permissions.authUser.id}` : '',
    permissions.personId ? `person_id.eq.${permissions.personId}` : '',
    permissions.email ? `grantee_email.eq.${normalizeEmail(permissions.email)}` : '',
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(',') : null
}

export async function listManageableLocalUnitIdsForCustomLists(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
}) {
  const authUserId = args.permissions.authUser?.id
  if (!authUserId) return [] as string[]

  const { data: relationshipRows, error: relationshipError } = await args.admin
    .from('user_unit_relationships')
    .select('local_unit_id, member_record_id')
    .eq('user_id', authUserId)
    .eq('status', 'active')

  if (relationshipError) {
    throw new Error(`Could not load custom list relationships: ${relationshipError.message}`)
  }

  const relationshipData =
    ((relationshipRows as Array<{ local_unit_id: string; member_record_id: string | null }> | null) ?? []).filter(
      (row) => Boolean(row.member_record_id),
    )

  const memberRecordIds = relationshipData
    .map((row) => row.member_record_id)
    .filter((value): value is string => Boolean(value))

  if (memberRecordIds.length === 0) {
    return [] as string[]
  }

  const { data: grantRows, error: grantError } = await args.admin
    .from('area_access_grants')
    .select('local_unit_id')
    .eq('area_code', 'custom_lists')
    .eq('access_level', 'manage')
    .is('revoked_at', null)
    .in('member_record_id', memberRecordIds)

  if (grantError) {
    throw new Error(`Could not load custom list management grants: ${grantError.message}`)
  }

  return [
    ...new Set(
      ((grantRows as Array<{ local_unit_id: string }> | null) ?? [])
        .map((row) => row.local_unit_id)
        .filter(Boolean),
    ),
  ]
}

async function listLinkedMemberRecordIds(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
  localUnitId?: string | null
}) {
  const authUserId = args.permissions.authUser?.id
  if (!authUserId) return [] as string[]

  let query = args.admin
    .from('user_unit_relationships')
    .select('member_record_id')
    .eq('user_id', authUserId)
    .eq('status', 'active')

  if (args.localUnitId) {
    query = query.eq('local_unit_id', args.localUnitId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Could not load linked member records: ${error.message}`)
  }

  return (((data as Array<{ member_record_id: string | null }> | null) ?? [])
    .map((row) => row.member_record_id)
    .filter((value): value is string => Boolean(value)))
}

export async function resolveCustomListLocalUnitId(args: {
  admin: SupabaseClient
  list: Pick<CustomListRow, 'local_unit_id' | 'council_id'>
}) {
  if (args.list.local_unit_id) {
    return args.list.local_unit_id
  }

  if (!args.list.council_id) {
    return null
  }

  const localUnit = await findLocalUnitByLegacyCouncilId({
    admin: args.admin,
    councilId: args.list.council_id,
  })

  return localUnit?.id ?? null
}

export async function resolveLegacyCouncilIdForLocalUnit(args: {
  admin: SupabaseClient
  localUnitId: string
}) {
  const { data, error } = await args.admin
    .from('local_units')
    .select('legacy_council_id')
    .eq('id', args.localUnitId)
    .maybeSingle<{ legacy_council_id: string | null }>()

  if (error) {
    throw new Error(`Could not load legacy council for local unit ${args.localUnitId}: ${error.message}`)
  }

  return data?.legacy_council_id ?? null
}

export async function listValidMemberPersonIdsForLocalUnit(args: {
  admin: SupabaseClient
  localUnitId: string
  personIds: string[]
}) {
  const uniquePersonIds = [...new Set(args.personIds.filter(Boolean))]
  if (uniquePersonIds.length === 0) {
    return [] as string[]
  }

  const { data: membershipRows, error: membershipError } = await args.admin
    .from('member_records')
    .select('legacy_people_id')
    .eq('local_unit_id', args.localUnitId)
    .in('legacy_people_id', uniquePersonIds)
    .is('archived_at', null)

  if (membershipError) {
    throw new Error(`Could not validate local-unit member records: ${membershipError.message}`)
  }

  const scopedPersonIds = [
    ...new Set(
      ((membershipRows as Array<{ legacy_people_id: string | null }> | null) ?? [])
        .map((row) => row.legacy_people_id)
        .filter((value): value is string => Boolean(value))
    ),
  ]

  if (scopedPersonIds.length === 0) {
    return [] as string[]
  }

  const { data: peopleRows, error: peopleError } = await args.admin
    .from('people')
    .select('id')
    .in('id', scopedPersonIds)
    .eq('primary_relationship_code', 'member')
    .is('archived_at', null)

  if (peopleError) {
    throw new Error(`Could not validate members in the active directory: ${peopleError.message}`)
  }

  return [
    ...new Set(
      ((peopleRows as Array<{ id: string | null }> | null) ?? [])
        .map((row) => row.id)
        .filter((value): value is string => Boolean(value))
    ),
  ]
}

export async function listValidMemberPeopleForLocalUnit(args: {
  admin: SupabaseClient
  localUnitId: string
}) {
  const { data: membershipRows, error: membershipError } = await args.admin
    .from('member_records')
    .select('legacy_people_id')
    .eq('local_unit_id', args.localUnitId)
    .is('archived_at', null)

  if (membershipError) {
    throw new Error(`Could not load local-unit member records: ${membershipError.message}`)
  }

  const personIds = [
    ...new Set(
      ((membershipRows as Array<{ legacy_people_id: string | null }> | null) ?? [])
        .map((row) => row.legacy_people_id)
        .filter((value): value is string => Boolean(value))
    ),
  ]

  if (personIds.length === 0) {
    return [] as CustomListPersonSummaryRow[]
  }

  const { data: peopleRows, error: peopleError } = await args.admin
    .from('people')
    .select('id, first_name, last_name, email, cell_phone, home_phone')
    .in('id', personIds)
    .eq('primary_relationship_code', 'member')
    .is('archived_at', null)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .returns<CustomListPersonSummaryRow[]>()

  if (peopleError) {
    throw new Error(`Could not load local-unit member directory entries: ${peopleError.message}`)
  }

  return decryptPeopleRecords((peopleRows as CustomListPersonSummaryRow[] | null) ?? [])
}


export async function listActiveCustomListShares(args: {
  admin: SupabaseClient
  customListId: string
}) {
  const { data, error } = await args.admin
    .from('v_effective_resource_access')
    .select('resource_access_grant_id, resource_key, person_id, user_id, granted_at')
    .eq('resource_type', 'custom_list')
    .eq('resource_key', args.customListId)
    .eq('is_effective', true)
    .not('user_id', 'is', null)
    .order('granted_at', { ascending: true })
    .returns<EffectiveResourceAccessRow[]>()

  if (error) {
    throw new Error(`Could not load active custom list shares: ${error.message}`)
  }

  return ((data as EffectiveResourceAccessRow[] | null) ?? []).map((row) => ({
    id: row.resource_access_grant_id,
    custom_list_id: row.resource_key,
    person_id: row.person_id,
    user_id: row.user_id,
    grantee_email: null,
    granted_at: row.granted_at ?? '',
    granted_by_auth_user_id: null,
  })) satisfies CustomListShareGrantRow[]
}

function isPreviewManagingCurrentCustomList(args: {
  permissions: CurrentUserPermissions
  list: Pick<CustomListRow, 'council_id' | 'local_unit_id'>
}) {
  const { permissions, list } = args

  if (!(permissions.isSuperAdmin && permissions.actingMode === 'admin')) {
    return false
  }

  if (permissions.activeLocalUnitId && list.local_unit_id && permissions.activeLocalUnitId === list.local_unit_id) {
    return true
  }

  if (permissions.councilId && list.council_id && permissions.councilId === list.council_id) {
    return true
  }

  return false
}

export async function hasStrictCustomListLifecycleAccess(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
  list: Pick<CustomListRow, 'id' | 'local_unit_id' | 'council_id'>
}) {
  if (isPreviewManagingCurrentCustomList({ permissions: args.permissions, list: args.list })) {
    return true
  }

  const userId = args.permissions.authUser?.id
  if (!userId) {
    return false
  }

  const localUnitId = await resolveCustomListLocalUnitId({
    admin: args.admin,
    list: args.list,
  })

  if (!localUnitId) {
    return false
  }

  const hasAreaManageAccess = await hasAreaAccess({
    admin: args.admin,
    userId,
    localUnitId,
    areaCode: 'custom_lists',
    minimumAccessLevel: 'manage',
  })

  if (hasAreaManageAccess) {
    return true
  }

  return hasResourceAccess({
    admin: args.admin,
    userId,
    localUnitId,
    resourceType: 'custom_list',
    resourceKey: args.list.id,
    minimumAccessLevel: 'manage',
  })
}

export async function listSharedCustomListIdsForUser(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
}) {
  const userId = args.permissions.authUser?.id
  if (!userId) {
    return [] as string[]
  }

  const rows = await listAccessibleCustomListIdsForUser({
    admin: args.admin,
    userId,
  })

  return [
    ...new Set(
      rows
        .map((row) => row.custom_list_id)
        .filter((value): value is string => Boolean(value))
    ),
  ]
}

export async function hasSharedCustomListsForUser(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
}) {
  const ids = await listSharedCustomListIdsForUser(args)
  return ids.length > 0
}

export async function listExplicitlySharedCustomListIdsForUser(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
}) {
  const memberRecordIds = await listLinkedMemberRecordIds({
    admin: args.admin,
    permissions: args.permissions,
  })

  if (memberRecordIds.length === 0) {
    return [] as string[]
  }

  const { data, error } = await args.admin
    .from('resource_access_grants')
    .select('resource_key')
    .eq('resource_type', 'custom_list')
    .is('revoked_at', null)
    .in('member_record_id', memberRecordIds)

  if (error) {
    throw new Error(`Could not load explicit custom list grants: ${error.message}`)
  }

  return [
    ...new Set(
      ((data as Array<{ resource_key: string | null }> | null) ?? [])
        .map((row) => row.resource_key)
        .filter((value): value is string => Boolean(value))
    ),
  ]
}

export async function hasExplicitlySharedCustomListsForUser(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
}) {
  const ids = await listExplicitlySharedCustomListIdsForUser(args)
  return ids.length > 0
}

export async function canManageCustomList(
  permissions: CurrentUserPermissions,
  list: Pick<CustomListRow, 'council_id' | 'local_unit_id'>,
  admin: SupabaseClient
) {
  if (isPreviewManagingCurrentCustomList({ permissions, list })) {
    return true
  }

  const userId = permissions.authUser?.id
  if (!userId) {
    return false
  }

  const localUnitId = await resolveCustomListLocalUnitId({
    admin,
    list,
  })

  if (!localUnitId) {
    return false
  }

  return hasAreaAccess({
    admin,
    userId,
    localUnitId,
    areaCode: 'custom_lists',
    minimumAccessLevel: 'manage',
  })
}

export async function canViewCustomList(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
  list: Pick<CustomListRow, 'id' | 'council_id' | 'local_unit_id'>
}) {
  if (isPreviewManagingCurrentCustomList({ permissions: args.permissions, list: args.list })) {
    return true
  }

  if (await canManageCustomList(args.permissions, args.list, args.admin)) {
    return true
  }

  const userId = args.permissions.authUser?.id
  if (!userId) {
    return false
  }

  const localUnitId = await resolveCustomListLocalUnitId({
    admin: args.admin,
    list: args.list,
  })

  if (!localUnitId) {
    return false
  }

  return hasResourceAccess({
    admin: args.admin,
    userId,
    localUnitId,
    resourceType: 'custom_list',
    resourceKey: args.list.id,
    minimumAccessLevel: 'interact',
  })
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
