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
  proposed_email: string | null
  proposed_cell_phone: string | null
  proposed_home_phone: string | null
  proposed_preferred_name: string | null
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
  key: 'email' | 'cell_phone' | 'home_phone'
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

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function valuesDiffer(left: string | null | undefined, right: string | null | undefined) {
  return normalizeText(left) !== normalizeText(right)
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

  const fields: ProfileChangeReviewField[] = [
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

  return fields.filter((field) => field.requested || valuesDiffer(field.currentValue, field.proposedValue))
}

export async function listProfileChangeReviewSummaries(args: {
  admin: SupabaseClient
  councilId: string
  statusCodes: string[]
  limit?: number
  decisionNoticeState?: 'all' | 'uncleared'
}) {
  const { admin, councilId, statusCodes, limit = 50, decisionNoticeState = 'all' } = args

  const { data: peopleData, error: peopleError } = await admin
    .from('people')
    .select('id, council_id, first_name, last_name, nickname, email, cell_phone, home_phone, other_phone')
    .eq('council_id', councilId)
    .is('archived_at', null)
    .is('merged_into_person_id', null)
    .returns<ProfileChangeReviewPerson[]>()

  if (peopleError) {
    throw new Error(`Could not load members for the review queue: ${peopleError.message}`)
  }

  const people = decryptPeopleRecords((peopleData as ProfileChangeReviewPerson[] | null) ?? [])
  if (people.length === 0) {
    return [] as ProfileChangeReviewSummary[]
  }

  const personIds = people.map((person) => person.id)
  const peopleById = new Map(people.map((person) => [person.id, person] as const))

  let requestQuery = admin
    .from('person_profile_change_requests')
    .select(
      'id, person_id, requested_at, status_code, reviewed_at, reviewed_by_auth_user_id, review_notes, proposed_email, proposed_cell_phone, proposed_home_phone, proposed_preferred_name, email_change_requested, cell_phone_change_requested, home_phone_change_requested, decision_notice_cleared_at'
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
  requestId: string
}) {
  const { admin, councilId, requestId } = args

  const { data: requestData, error: requestError } = await admin
    .from('person_profile_change_requests')
    .select(
      'id, person_id, requested_at, status_code, reviewed_at, reviewed_by_auth_user_id, review_notes, proposed_email, proposed_cell_phone, proposed_home_phone, proposed_preferred_name, email_change_requested, cell_phone_change_requested, home_phone_change_requested, decision_notice_cleared_at'
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

  const { data: personData, error: personError } = await admin
    .from('people')
    .select('id, council_id, first_name, last_name, nickname, email, cell_phone, home_phone, other_phone')
    .eq('id', request.person_id)
    .eq('council_id', councilId)
    .maybeSingle<ProfileChangeReviewPerson>()

  if (personError) {
    throw new Error(`Could not load the member tied to this review: ${personError.message}`)
  }

  const person = personData ? decryptPeopleRecord(personData) : null
  if (!person) {
    return null
  }

  return {
    request,
    person,
    changedFields: buildProfileChangeReviewFields({ person, request }),
  } satisfies ProfileChangeReviewSummary
}
