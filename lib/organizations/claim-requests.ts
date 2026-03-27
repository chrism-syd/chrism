import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveOrganizationName } from '@/lib/organizations/names'

export type CouncilClaimLookupOption = {
  councilId: string
  organizationId: string
  councilNumber: string
  councilName: string
  city: string | null
  parishAssociations: string[]
  displayName: string
  searchText: string
}

type CouncilRow = { id: string; name: string; council_number: string; organization_id: string }
type OrganizationRow = { id: string; display_name: string | null; preferred_name: string | null }
type OrganizationKofcProfileRow = { organization_id: string; lookup_city: string | null; parish_associations: string[] | null }
type ExistingPendingClaimRow = { id: string }

export function normalizeClaimText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function normalizeClaimEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export function formatParishSummary(parishes: string[]) {
  return parishes.filter(Boolean).join(', ')
}

export function formatLookupLocation(city: string | null, parishes: string[]) {
  const parishSummary = formatParishSummary(parishes)
  if (city && parishSummary) return `${city} (${parishSummary})`
  return city ?? parishSummary ?? ''
}

export async function listCouncilClaimLookupOptions() {
  const admin = createAdminClient()
  const { data: councilData, error: councilError } = await admin.from('councils').select('id, name, council_number, organization_id').order('council_number', { ascending: true })
  if (councilError) throw new Error(councilError.message)

  const councils = (councilData as CouncilRow[] | null) ?? []
  const organizationIds = [...new Set(councils.map((row) => row.organization_id).filter(Boolean))]
  const organizationsById = new Map<string, OrganizationRow>()
  const kofcProfilesByOrganizationId = new Map<string, OrganizationKofcProfileRow>()

  if (organizationIds.length > 0) {
    const { data: organizationData, error: organizationError } = await admin.from('organizations').select('id, display_name, preferred_name').in('id', organizationIds)
    if (organizationError) throw new Error(organizationError.message)
    for (const row of ((organizationData as OrganizationRow[] | null) ?? [])) organizationsById.set(row.id, row)

    const { data: kofcProfileData, error: kofcProfileError } = await admin.from('organization_kofc_profiles').select('organization_id, lookup_city, parish_associations').in('organization_id', organizationIds)
    if (kofcProfileError) throw new Error(kofcProfileError.message)
    for (const row of ((kofcProfileData as OrganizationKofcProfileRow[] | null) ?? [])) kofcProfilesByOrganizationId.set(row.organization_id, row)
  }

  return councils.map<CouncilClaimLookupOption>((row) => {
    const organization = organizationsById.get(row.organization_id) ?? null
    const kofcProfile = kofcProfilesByOrganizationId.get(row.organization_id) ?? null
    const city = normalizeClaimText(kofcProfile?.lookup_city)
    const parishAssociations = (kofcProfile?.parish_associations ?? []).filter(Boolean)
    const organizationName = getEffectiveOrganizationName(organization)
    const councilName = normalizeClaimText(row.name) ?? organizationName ?? 'Council'
    const displayName = `${councilName} (${row.council_number})`
    const searchText = [row.council_number, councilName, organizationName, city, ...parishAssociations].filter(Boolean).join(' ').toLowerCase()

    return {
      councilId: row.id,
      organizationId: row.organization_id,
      councilNumber: row.council_number,
      councilName,
      city,
      parishAssociations,
      displayName,
      searchText,
    }
  })
}

type InsertClaimRequestArgs = {
  organizationId?: string | null
  councilId?: string | null
  requestedByAuthUserId?: string | null
  requestedByPersonId?: string | null
  requesterName: string
  requesterEmail: string
  requesterPhone?: string | null
  requestedCouncilNumber?: string | null
  requestedCouncilName?: string | null
  requestedCity?: string | null
  requestNotes?: string | null
  initiatedViaCode: 'signed_in_member' | 'public_request'
}

export async function insertOrganizationClaimRequest(args: InsertClaimRequestArgs) {
  const admin = createAdminClient()
  const payload = {
    organization_id: args.organizationId ?? null,
    council_id: args.councilId ?? null,
    requested_by_auth_user_id: args.requestedByAuthUserId ?? null,
    requested_by_person_id: args.requestedByPersonId ?? null,
    requester_name: args.requesterName,
    requester_email: args.requesterEmail,
    requester_phone: args.requesterPhone ?? null,
    requested_council_number: args.requestedCouncilNumber ?? null,
    requested_council_name: args.requestedCouncilName ?? null,
    requested_city: args.requestedCity ?? null,
    request_notes: args.requestNotes ?? null,
    initiated_via_code: args.initiatedViaCode,
    status_code: 'pending',
  }

  if (args.organizationId && args.requestedByAuthUserId) {
    const { data: existingPending, error: existingPendingError } = await admin
      .from('organization_claim_requests')
      .select('id')
      .eq('organization_id', args.organizationId)
      .eq('requested_by_auth_user_id', args.requestedByAuthUserId)
      .eq('status_code', 'pending')
      .maybeSingle<ExistingPendingClaimRow>()

    if (existingPendingError) throw new Error(existingPendingError.message)

    if (existingPending?.id) {
      const { error: updateError } = await admin
        .from('organization_claim_requests')
        .update({
          ...payload,
          reviewed_at: null,
          reviewed_by_auth_user_id: null,
          review_notes: null,
        })
        .eq('id', existingPending.id)

      if (updateError) throw new Error(updateError.message)
      return existingPending.id
    }
  }

  const { data, error } = await admin.from('organization_claim_requests').insert(payload).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}
