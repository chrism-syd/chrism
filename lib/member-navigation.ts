import type { SupabaseClient } from '@supabase/supabase-js'
import type { CurrentUserPermissions } from '@/lib/auth/permissions'

type MemberInvitationSource = 'claimed_submission' | 'submission_match' | 'attendee_match' | 'external_invitee'

type SubmissionRow = {
  id: string
  event_id: string
  last_responded_at: string
}

type AttendeeRow = {
  event_person_rsvp_id: string
}

type ExternalInviteRow = {
  event_id: string
}

type EventRow = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  location_name: string | null
  status_code: string
}

type HostInviteRow = {
  event_id: string
  rsvp_link_token: string | null
}

type CouncilNumberRow = {
  council_number: string | null
}

export type MemberInvitedEvent = {
  event_id: string
  event_title: string
  starts_at: string
  ends_at: string
  location_name: string | null
  source_label: string
  host_token: string | null
  submission_id: string | null
}

type CandidateMatch = {
  source: MemberInvitationSource
  submissionId: string | null
  lastTouchedAt: string | null
}

const SOURCE_PRIORITY: Record<MemberInvitationSource, number> = {
  claimed_submission: 4,
  submission_match: 3,
  attendee_match: 2,
  external_invitee: 1,
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null
}

function sourceLabel(source: MemberInvitationSource) {
  if (source === 'external_invitee') return 'Guest invite'
  return 'RSVP invitation'
}

function compareMatchPriority(left: CandidateMatch, right: CandidateMatch) {
  return SOURCE_PRIORITY[left.source] - SOURCE_PRIORITY[right.source]
}

function sortMemberEvents(left: MemberInvitedEvent, right: MemberInvitedEvent) {
  return new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()
}

function rememberMatch(map: Map<string, CandidateMatch>, eventId: string, candidate: CandidateMatch) {
  const existing = map.get(eventId)

  if (!existing || compareMatchPriority(candidate, existing) > 0) {
    map.set(eventId, candidate)
    return
  }

  if (compareMatchPriority(candidate, existing) === 0) {
    const existingTime = existing.lastTouchedAt ? new Date(existing.lastTouchedAt).getTime() : 0
    const candidateTime = candidate.lastTouchedAt ? new Date(candidate.lastTouchedAt).getTime() : 0

    if (candidateTime > existingTime) {
      map.set(eventId, candidate)
    }
  }
}

async function loadSubmissionRowsByIds(args: {
  admin: SupabaseClient
  submissionIds: string[]
}) {
  const { admin, submissionIds } = args

  if (submissionIds.length === 0) {
    return [] as SubmissionRow[]
  }

  const { data, error } = await admin
    .from('event_person_rsvps')
    .select('id, event_id, last_responded_at')
    .eq('status_code', 'active')
    .in('id', submissionIds)
    .returns<SubmissionRow[]>()

  if (error) {
    throw new Error(`Could not load invited RSVP submissions: ${error.message}`)
  }

  return data ?? []
}

export async function getPublicMeetingsHref(args: {
  admin: SupabaseClient
  councilId: string | null
}) {
  const { admin, councilId } = args

  if (!councilId) {
    return null
  }

  const { data, error } = await admin
    .from('councils')
    .select('council_number')
    .eq('id', councilId)
    .maybeSingle<CouncilNumberRow>()

  if (error) {
    throw new Error(`Could not load public meetings link: ${error.message}`)
  }

  const councilNumber = data?.council_number?.trim()
  return councilNumber ? `/councils/${councilNumber}/meetings` : null
}

export async function listMemberInvitedEvents(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
  limit?: number
}) {
  const { admin, permissions, limit = 12 } = args

  if (!permissions.authUser || permissions.hasStaffAccess) {
    return [] as MemberInvitedEvent[]
  }

  const normalizedEmail = normalizeEmail(permissions.email)
  const matchesByEventId = new Map<string, CandidateMatch>()

  const claimedPromise = admin
    .from('event_person_rsvps')
    .select('id, event_id, last_responded_at')
    .eq('status_code', 'active')
    .eq('claimed_by_user_id', permissions.authUser.id)
    .returns<SubmissionRow[]>()

  const primaryEmailPromise = normalizedEmail
    ? admin
        .from('event_person_rsvps')
        .select('id, event_id, last_responded_at')
        .eq('status_code', 'active')
        .ilike('primary_email', normalizedEmail)
        .returns<SubmissionRow[]>()
    : Promise.resolve({ data: [] as SubmissionRow[], error: null })

  const matchedPersonPromise = permissions.personId
    ? admin
        .from('event_person_rsvps')
        .select('id, event_id, last_responded_at')
        .eq('status_code', 'active')
        .eq('matched_person_id', permissions.personId)
        .returns<SubmissionRow[]>()
    : Promise.resolve({ data: [] as SubmissionRow[], error: null })

  const attendeeEmailPromise = normalizedEmail
    ? admin
        .from('event_person_rsvp_attendees')
        .select('event_person_rsvp_id')
        .ilike('attendee_email', normalizedEmail)
        .returns<AttendeeRow[]>()
    : Promise.resolve({ data: [] as AttendeeRow[], error: null })

  const attendeePersonPromise = permissions.personId
    ? admin
        .from('event_person_rsvp_attendees')
        .select('event_person_rsvp_id')
        .eq('matched_person_id', permissions.personId)
        .returns<AttendeeRow[]>()
    : Promise.resolve({ data: [] as AttendeeRow[], error: null })

  const externalInvitePromise = normalizedEmail
    ? admin
        .from('event_external_invitees')
        .select('event_id')
        .ilike('invitee_email', normalizedEmail)
        .returns<ExternalInviteRow[]>()
    : Promise.resolve({ data: [] as ExternalInviteRow[], error: null })

  const [
    claimedResult,
    primaryEmailResult,
    matchedPersonResult,
    attendeeEmailResult,
    attendeePersonResult,
    externalInviteResult,
  ] = await Promise.all([
    claimedPromise,
    primaryEmailPromise,
    matchedPersonPromise,
    attendeeEmailPromise,
    attendeePersonPromise,
    externalInvitePromise,
  ])

  const resultErrors = [
    claimedResult.error,
    primaryEmailResult.error,
    matchedPersonResult.error,
    attendeeEmailResult.error,
    attendeePersonResult.error,
    externalInviteResult.error,
  ].filter(Boolean)

  if (resultErrors.length > 0) {
    throw new Error(`Could not load member event invitations: ${resultErrors[0]?.message ?? 'Unknown error'}`)
  }

  for (const row of claimedResult.data ?? []) {
    rememberMatch(matchesByEventId, row.event_id, {
      source: 'claimed_submission',
      submissionId: row.id,
      lastTouchedAt: row.last_responded_at,
    })
  }

  for (const row of [...(primaryEmailResult.data ?? []), ...(matchedPersonResult.data ?? [])]) {
    rememberMatch(matchesByEventId, row.event_id, {
      source: 'submission_match',
      submissionId: row.id,
      lastTouchedAt: row.last_responded_at,
    })
  }

  const attendeeSubmissionIds = [
    ...(attendeeEmailResult.data ?? []).map((row) => row.event_person_rsvp_id),
    ...(attendeePersonResult.data ?? []).map((row) => row.event_person_rsvp_id),
  ]
  const uniqueAttendeeSubmissionIds = [...new Set(attendeeSubmissionIds.filter(Boolean))]
  const attendeeSubmissionRows = await loadSubmissionRowsByIds({
    admin,
    submissionIds: uniqueAttendeeSubmissionIds,
  })

  for (const row of attendeeSubmissionRows) {
    rememberMatch(matchesByEventId, row.event_id, {
      source: 'attendee_match',
      submissionId: row.id,
      lastTouchedAt: row.last_responded_at,
    })
  }

  for (const row of externalInviteResult.data ?? []) {
    rememberMatch(matchesByEventId, row.event_id, {
      source: 'external_invitee',
      submissionId: null,
      lastTouchedAt: null,
    })
  }

  const eventIds = [...matchesByEventId.keys()]
  if (eventIds.length === 0) {
    return [] as MemberInvitedEvent[]
  }

  const [{ data: eventRows, error: eventsError }, { data: hostRows, error: hostError }] = await Promise.all([
    admin
      .from('events')
      .select('id, title, starts_at, ends_at, location_name, status_code')
      .in('id', eventIds)
      .not('status_code', 'in', '(cancelled,completed)')
      .returns<EventRow[]>(),
    admin
      .from('event_invited_councils')
      .select('event_id, rsvp_link_token')
      .eq('is_host', true)
      .in('event_id', eventIds)
      .returns<HostInviteRow[]>(),
  ])

  if (eventsError) {
    throw new Error(`Could not load invited events: ${eventsError.message}`)
  }

  if (hostError) {
    throw new Error(`Could not load host council invites: ${hostError.message}`)
  }

  const hostTokenByEventId = new Map((hostRows ?? []).map((row) => [row.event_id, row.rsvp_link_token]))

  return (eventRows ?? [])
    .map((row) => {
      const match = matchesByEventId.get(row.id)
      if (!match) return null

      return {
        event_id: row.id,
        event_title: row.title,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        location_name: row.location_name,
        source_label: sourceLabel(match.source),
        host_token: hostTokenByEventId.get(row.id) ?? null,
        submission_id: match.submissionId,
      } satisfies MemberInvitedEvent
    })
    .filter((row): row is MemberInvitedEvent => Boolean(row))
    .sort(sortMemberEvents)
    .slice(0, limit)
}
