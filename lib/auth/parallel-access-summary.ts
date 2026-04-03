type ParallelAccessRow = {
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

export type ParallelAccessSummary = {
  organizationId: string | null
  isOrganizationMember: boolean
  hasStaffAccess: boolean
  canManageAdmins: boolean
  canAccessMemberData: boolean
  canManageEvents: boolean
  canManageCustomLists: boolean
  canAccessOrganizationSettings: boolean
  canReviewClaims: boolean
}

function anyRow(rows: ParallelAccessRow[], predicate: (row: ParallelAccessRow) => boolean) {
  return rows.some(predicate)
}

export function getParallelAccessSummary(args: {
  rows: ParallelAccessRow[]
}): ParallelAccessSummary {
  const rows = args.rows ?? []

  const organizationId = rows.find((row) => row.organization_id)?.organization_id ?? null
  const canAccessMemberData = anyRow(rows, (row) => Boolean(row.can_manage_members))
  const canManageEvents = anyRow(rows, (row) => Boolean(row.can_manage_events))
  const canManageCustomLists = anyRow(rows, (row) => Boolean(row.can_manage_custom_lists))
  const canReviewClaims = anyRow(rows, (row) => Boolean(row.can_manage_claims))
  const canManageAdmins = anyRow(rows, (row) => Boolean(row.can_manage_admins))
  const canAccessOrganizationSettings = anyRow(rows, (row) => Boolean(row.can_manage_local_unit_settings))

  const hasStaffAccess =
    canAccessMemberData ||
    canManageEvents ||
    canManageCustomLists ||
    canReviewClaims ||
    canManageAdmins ||
    canAccessOrganizationSettings

  return {
    organizationId,
    isOrganizationMember: rows.length > 0,
    hasStaffAccess,
    canManageAdmins,
    canAccessMemberData,
    canManageEvents,
    canManageCustomLists,
    canAccessOrganizationSettings,
    canReviewClaims,
  }
}
