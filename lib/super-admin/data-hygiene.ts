import { createAdminClient } from '@/lib/supabase/admin'

export type DataHygieneSummary = {
  redundantEventAssignmentCount: number
  nullUserFossilCount: number
  resolvedNullUserFossilCount: number
  legacyGapCount: number
  unresolvedLegacyWriteCount: number
}

export type EventAssignmentRedundancyRow = {
  redundant_assignment_id: string
  redundant_assignment_scope: string
  redundancy_reason: string
  local_unit_id: string
  local_unit_name: string | null
  event_id: string | null
  event_title: string | null
  member_record_id: string
  user_id: string | null
  role_code: string | null
  covered_by_assignment_id: string
  covered_by_scope: string
}

export type NullUserFossilRow = {
  source_table: string
  source_row_id: string
  local_unit_name: string | null
  person_id: string | null
  grantee_email: string | null
  legacy_owner_id: string | null
  notes: string | null
  created_at: string | null
}

export type ResolvedNullUserFossilRow = NullUserFossilRow & {
  resolution_code: string | null
  resolution_notes: string | null
  fossil_resolved_at: string | null
  resolved_by_auth_user_id: string | null
}

export type LegacyRetirementReadinessRow = {
  org_admin_gap_count: number | null
  custom_list_gap_count: number | null
  event_gap_count: number | null
  council_admin_legacy_write_count: number | null
  organization_admin_legacy_write_count: number | null
  custom_list_access_legacy_write_count: number | null
  gap_free: boolean | null
}

export async function getSuperAdminDataHygieneSnapshot() {
  const admin = createAdminClient()

  const [
    redundancyResult,
    redundancyCountResult,
    fossilResult,
    fossilCountResult,
    resolvedFossilResult,
    resolvedFossilCountResult,
    readinessResult,
    legacyGapResult,
  ] = await Promise.all([
    admin
      .from('v_parallel_event_assignment_redundancy')
      .select(
        'redundant_assignment_id, redundant_assignment_scope, redundancy_reason, local_unit_id, local_unit_name, event_id, event_title, member_record_id, user_id, role_code, covered_by_assignment_id, covered_by_scope'
      )
      .order('local_unit_name', { ascending: true })
      .order('event_title', { ascending: true })
      .limit(50),
    admin
      .from('v_parallel_event_assignment_redundancy')
      .select('redundant_assignment_id', { count: 'exact', head: true }),
    admin
      .from('v_parallel_null_user_fossils')
      .select('source_table, source_row_id, local_unit_name, person_id, grantee_email, legacy_owner_id, notes, created_at')
      .order('source_table', { ascending: true })
      .order('local_unit_name', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(50),
    admin
      .from('v_parallel_null_user_fossils')
      .select('source_row_id', { count: 'exact', head: true }),
    admin
      .from('v_parallel_resolved_null_user_fossils')
      .select(
        'source_table, source_row_id, local_unit_name, person_id, grantee_email, legacy_owner_id, notes, created_at, resolution_code, resolution_notes, fossil_resolved_at, resolved_by_auth_user_id'
      )
      .order('fossil_resolved_at', { ascending: false })
      .limit(12),
    admin
      .from('v_parallel_resolved_null_user_fossils')
      .select('source_row_id', { count: 'exact', head: true }),
    admin
      .from('v_parallel_retirement_readiness')
      .select('org_admin_gap_count, custom_list_gap_count, event_gap_count, council_admin_legacy_write_count, organization_admin_legacy_write_count, custom_list_access_legacy_write_count, gap_free')
      .limit(1)
      .maybeSingle(),
    admin
      .from('v_parallel_legacy_gap_report')
      .select('gap_type', { count: 'exact', head: true }),
  ])

  const redundancyRows = (redundancyResult.data as EventAssignmentRedundancyRow[] | null) ?? []
  const fossilRows = (fossilResult.data as NullUserFossilRow[] | null) ?? []
  const resolvedFossilRows = (resolvedFossilResult.data as ResolvedNullUserFossilRow[] | null) ?? []
  const readiness = (readinessResult.data as LegacyRetirementReadinessRow | null) ?? null
  const legacyGapCount = legacyGapResult.count ?? 0

  const summary: DataHygieneSummary = {
    redundantEventAssignmentCount: redundancyCountResult.count ?? 0,
    nullUserFossilCount: fossilCountResult.count ?? 0,
    resolvedNullUserFossilCount: resolvedFossilCountResult.count ?? 0,
    legacyGapCount,
    unresolvedLegacyWriteCount:
      (readiness?.council_admin_legacy_write_count ?? 0) +
      (readiness?.organization_admin_legacy_write_count ?? 0) +
      (readiness?.custom_list_access_legacy_write_count ?? 0),
  }

  return {
    summary,
    redundancyRows,
    fossilRows,
    resolvedFossilRows,
    readiness,
    errors: {
      redundancy: redundancyResult.error?.message ?? null,
      fossils: fossilResult.error?.message ?? null,
      resolvedFossils: resolvedFossilResult.error?.message ?? null,
      readiness: readinessResult.error?.message ?? null,
      legacyGaps: legacyGapResult.error?.message ?? null,
    },
  }
}
