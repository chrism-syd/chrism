import type { SupabaseClient } from '@supabase/supabase-js'
import {
  decryptPeopleRecord,
  decryptPeopleRecords,
  decryptProfileChangeRequestRecord,
  decryptProfileChangeRequestRecords,
} from '@/lib/security/pii'

export type ProfileChangeRequestRow = {
  id: string
  person_id: string
  requested_at: string
  status_code: string
  reviewed_at: string | null
  reviewed_by_auth_user_id: string | null
  review_notes: string | null
  proposed_first_name: string | null
  proposed_last_name: string | null
  proposed_preferred_name: string | null
  proposed_email: string | null
  proposed_cell_phone: string | null
  proposed_home_phone: string | null
  email_change_requested: boolean
  cell_phone_change_requested: boolean
  home_phone_change_requested: boolean
  decision_notice_cleared_at: string | null
}

export type ProfileChangeReviewPerson = {
  id: string
  council_id: string | null
  first_name: string
  last_name: string
  nickname: string | null
  email: string | null
  cell_phone: string | null
  home_phone: string | null
  other_phone: string | null
}

export type ProfileChangeReviewField = {
  key: 'first_name' | 'last_name' | 'preferred_name' | 'email' | 'cell_phone' | 'home_phone'
  label: string
  currentValue: string | null
  proposedValue: string | null
  requested: boolean
}

export type ProfileChangeReviewSummary = {
  request: ProfileChangeRequestRow
  person: ProfileChangeReviewPerson
  changedFields: ProfileChangeReviewField[]
}

type ActiveOrganizationAdminAssignmentRow = {
  person_id: string | null
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function valuesDiffer(left: string | null | undefined, right: string | null | undefined) {
  return normalizeText(left) !== normalizeText(right)
}

function isDecisionStatus(statusCode: string) {
  return statusCode === 'approved' || statusCode === 'rejected'
}

export function getDisplayName(person: Pick<ProfileChangeReviewPerson, 'first_name' | 'last_name' | 'nickname'>) {
  const leadName = normalizeText(person.nickname) ?? normalizeText(person.first_name) ?? ''
  return `${leadName} ${normalizeText(person.last_name) ?? ''}`.trim()
}

export function buildProfileChangeReviewFields(args: {
  person: ProfileChangeReviewPerson
  request: ProfileChangeRequestRow
}) {
  const { person, request } = args
  const isDecision = isDecisionStatus(request.status_code)

  const proposedFirstName = normalizeText(request.proposed_first_name)
  const proposedLastName = normalizeText(request.proposed_last_name)
  const proposedPreferredName = normalizeText(request.proposed_preferred_name)

  const fields: ProfileChangeReviewField[] = [
    {
      key: 'first_name',
      label: 'First name',
      currentValue: normalizeText(person.first_name),
      proposedValue: proposedFirstName,
      requested: isDecision
        ? Boolean(proposedFirstName)
        : Boolean(proposedFirstName && valuesDiffer(person.first_name, proposedFirstName)),
    },
    {
      key: 'last_name',
      label: 'Last name',
      currentValue: normalizeText(person.last_name),
      proposedValue: proposedLastName,
      requested: isDecision
        ? Boolean(proposedLastName)
        : Boolean(proposedLastName && valuesDiffer(person.last_name, proposedLastName)),
    },
    {
      key: 'preferred_name',
      label: 'Preferred name',
      currentValue: normalizeText(person.nickname),
      proposedValue: proposedPreferredName,
      requested: isDecision
        ? Boolean(proposedPreferredName)
        : Boolean(proposedPreferredName && valuesDiffer(person.nickname, proposedPreferredName)),
    },
    {
      key: 'email',
      label: 'Email',
      currentValue: normalizeText(person.email),
      proposedValue: normalizeText(request.proposed_email),
      requested: Boolean(request.email_change_requested),
    },
    {
      key: 'cell_phone',
      label: 'Cell phone',
      currentValue: normalizeText(person.cell_phone),
      proposedValue: normalizeText(request.proposed_cell_phone),
      requested: Boolean(request.cell_phone_change_requested),
    },
    {
      key: 'home_phone',
      label: 'Home phone',
      currentValue: normalizeText(person.home_phone),
      proposedValue: normalizeText(request.proposed_home_phone),
      requested: Boolean(request.home_phone_change_requested),
    },
  ]

  return fields.filter((field) => field.requested)
}

export async function listProfileChangeReviewSummaries(args: {
  admin: SupabaseClient
  councilId: string
  organizationId?: string | null
  statusCodes: string[]
  limit?: number
  decisionNoticeState?: 'all' | 'uncleared'
}) {
  const { admin, councilId, organizationId = null, statusCodes, limit = 50, decisionNoticeState = 'all' } = args

  const [localPeopleResult, organizationAdminAssignmentsResult] = await Promise.all([
    admin
      .from('people')
      .select('id, council_id, first_name, last_name, nickname, email, cell_phone, home_phone, other_phone')
      .eq('council_id', councilId)
      .is('archived_at', null)
      .is('merged_into_person_id', null)
      .returns<ProfileChangeReviewPerson[]>(),
    organizationId
      ? admin
          .from('organization_admin_assignments')
          .select('person_id')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .returns<ActiveOrganizationAdminAssignmentRow[]>()
      : Promise.resolve({ data: [] as ActiveOrganizationAdminAssignmentRow[], error: null }),
  ])

  if (localPeopleResult.error) {
    throw new Error(`Could not load members for the review queue: ${localPeopleResult.error.message}`)
  }

  if (organizationAdminAssignmentsResult.error) {
    throw new Error(`Could not load organization admin assignments for the review queue: ${organizationAdminAssignmentsResult.error.message}`)
  }

  const localPeople = decryptPeopleRecords((localPeopleResult.data as ProfileChangeReviewPerson[] | null) ?? [])
  const localPeopleById = new Map(localPeople.map((person) => [person.id, person] as const))

  const additionalPersonIds = [
    ...new Set(
      ((organizationAdminAssignmentsResult.data as ActiveOrganizationAdminAssignmentRow[] | null) ?? [])
        .map((row) => row.person_id)
        .filter((personId): personId is string => Boolean(personId && !localPeopleById.has(personId)))
    ),
  ]

  const additionalPeopleResult =
    additionalPersonIds.length > 0
      ? await admin
          .from('people')
          .select('id, council_id, first_name, last_name, nickname, email, cell_phone, home_phone, other_phone')
          .in('id', additionalPersonIds)
          .is('archived_at', null)
          .is('merged_into_person_id', null)
          .returns<ProfileChangeReviewPerson[]>()
      : { data: [] as ProfileChangeReviewPerson[], error: null }

  if (additionalPeopleResult.error) {
    throw new Error(`Could not load external admin contacts for the review queue: ${additionalPeopleResult.error.message}`)
  }

  const additionalPeople = decryptPeopleRecords((additionalPeopleResult.data as ProfileChangeReviewPerson[] | null) ?? [])
  const people = [...localPeople, ...additionalPeople]

  if (people.length === 0) {
    return [] as ProfileChangeReviewSummary[]
  }

  const personIds = people.map((person) => person.id)
  const peopleById = new Map(people.map((person) => [person.id, person] as const))

  let requestQuery = admin
    .from('person_profile_change_requests')
    .select(
      'id, person_id, requested_at, status_code, reviewed_at, reviewed_by_auth_user_id, review_notes, proposed_first_name, proposed_last_name, proposed_preferred_name, proposed_email, proposed_cell_phone, proposed_home_phone, email_change_requested, cell_phone_change_requested, home_phone_change_requested, decision_notice_cleared_at'
    )
    .in('person_id', personIds)
    .in('status_code', statusCodes)
    .order(statusCodes.includes('pending') ? 'requested_at' : 'reviewed_at', { ascending: false })
    .limit(limit)

  if (decisionNoticeState === 'uncleared' && !statusCodes.includes('pending')) {
    requestQuery = requestQuery.is('decision_notice_cleared_at', null)
  }

  const { data: requestData, error: requestError } = await requestQuery.returns<ProfileChangeRequestRow[]>()

  if (requestError) {
    throw new Error(`Could not load profile change requests: ${requestError.message}`)
  }

  const requests = decryptProfileChangeRequestRecords((requestData as ProfileChangeRequestRow[] | null) ?? [])

  return requests
    .map((request) => {
      const person = peopleById.get(request.person_id)
      if (!person) return null
      return {
        request,
        person,
        changedFields: buildProfileChangeReviewFields({ person, request }),
      } satisfies ProfileChangeReviewSummary
    })
    .filter((value): value is ProfileChangeReviewSummary => Boolean(value))
}

export async function getProfileChangeReviewSummary(args: {
  admin: SupabaseClient
  councilId: string
  organizationId?: string | null
  requestId: string
}) {
  const { admin, councilId, organizationId = null, requestId } = args

  const { data: requestData, error: requestError } = await admin
    .from('person_profile_change_requests')
    .select(
      'id, person_id, requested_at, status_code, reviewed_at, reviewed_by_auth_user_id, review_notes, proposed_first_name, proposed_last_name, proposed_preferred_name, proposed_email, proposed_cell_phone, proposed_home_phone, email_change_requested, cell_phone_change_requested, home_phone_change_requested, decision_notice_cleared_at'
    )
    .eq('id', requestId)
    .maybeSingle<ProfileChangeRequestRow>()

  if (requestError) {
    throw new Error(`Could not load that profile change request: ${requestError.message}`)
  }

  const request = requestData ? decryptProfileChangeRequestRecord(requestData) : null
  if (!request) {
    return null
  }

  const [personResult, organizationAdminAccessResult] = await Promise.all([
    admin
      .from('people')
      .select('id, council_id, first_name, last_name, nickname, email, cell_phone, home_phone, other_phone')
      .eq('id', request.person_id)
      .maybeSingle<ProfileChangeReviewPerson>(),
    organizationId
      ? admin
          .from('organization_admin_assignments')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('person_id', request.person_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (personResult.error) {
    throw new Error(`Could not load the person tied to this review: ${personResult.error.message}`)
  }

  if (organizationAdminAccessResult.error) {
    throw new Error(`Could not verify organization admin access for this review: ${organizationAdminAccessResult.error.message}`)
  }

  const person = personResult.data ? decryptPeopleRecord(personResult.data) : null
  if (!person) {
    return null
  }

  const isCouncilScopedPerson = person.council_id === councilId
  const hasOrganizationAdminAccess = Boolean(organizationAdminAccessResult.data)

  if (!isCouncilScopedPerson && !hasOrganizationAdminAccess) {
    return null
  }

  return {
    request,
    person,
    changedFields: buildProfileChangeReviewFields({ person, request }),
  } satisfies ProfileChangeReviewSummary
}
