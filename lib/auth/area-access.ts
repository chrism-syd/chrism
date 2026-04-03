import { createAdminClient } from '@/lib/supabase/admin'

export type ManagedAreaCode = 'members' | 'events' | 'custom_lists' | 'claims' | 'admins' | 'local_unit_settings'
export type ManagedAreaAccessLevel = 'read_only' | 'edit_manage' | 'manage' | 'interact'

export type AccessibleLocalUnitRow = {
  local_unit_id: string
  local_unit_name: string
  area_code: ManagedAreaCode
  access_level: ManagedAreaAccessLevel
}

export async function listAccessibleLocalUnitsForArea(args: {
  admin?: ReturnType<typeof createAdminClient>
  userId: string
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}) {
  const admin = args.admin ?? createAdminClient()
  const { data, error } = await admin.rpc('list_accessible_local_units_for_area', {
    p_user_id: args.userId,
    p_area_code: args.areaCode,
    p_min_access_level: args.minimumAccessLevel,
  })

  if (error) {
    throw new Error(`Could not list accessible local units for ${args.areaCode}: ${error.message}`)
  }

  return ((data ?? []) as AccessibleLocalUnitRow[]).filter((row) => Boolean(row.local_unit_id))
}

export async function hasAreaAccess(args: {
  admin?: ReturnType<typeof createAdminClient>
  userId: string
  localUnitId: string
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}) {
  const admin = args.admin ?? createAdminClient()
  const { data, error } = await admin.rpc('has_area_access', {
    p_user_id: args.userId,
    p_local_unit_id: args.localUnitId,
    p_area_code: args.areaCode,
    p_min_access_level: args.minimumAccessLevel,
  })

  if (error) {
    throw new Error(`Could not evaluate ${args.areaCode} access: ${error.message}`)
  }

  return Boolean(data)
}

export async function findLocalUnitByLegacyCouncilId(args: {
  admin?: ReturnType<typeof createAdminClient>
  councilId: string
}) {
  const admin = args.admin ?? createAdminClient()
  const { data, error } = await admin
    .from('local_units')
    .select('id, legacy_council_id')
    .eq('legacy_council_id', args.councilId)
    .maybeSingle<{ id: string; legacy_council_id: string | null }>()

  if (error) {
    throw new Error(`Could not load local unit for council ${args.councilId}: ${error.message}`)
  }

  return data ?? null
}


export async function findLocalUnitByLegacyOrganizationId(args: {
  admin?: ReturnType<typeof createAdminClient>
  organizationId: string
}) {
  const admin = args.admin ?? createAdminClient()
  const { data, error } = await admin
    .from('local_units')
    .select('id, legacy_organization_id, legacy_council_id, display_name, local_unit_kind, status')
    .eq('legacy_organization_id', args.organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{
      id: string
      legacy_organization_id: string | null
      legacy_council_id: string | null
      display_name: string | null
      local_unit_kind: string | null
      status: string | null
    }>()

  if (error) {
    throw new Error(`Could not load local unit for organization ${args.organizationId}: ${error.message}`)
  }

  return data ?? null
}
