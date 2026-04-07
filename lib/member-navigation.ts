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
  ends_at: string | null
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

type CouncilInvitedEventRow = {
  event_id: string
  invited_council_name: string
  invited_council_number: string | null
  invite_email: string | null
  invite_contact_name: string | null
  sort_order: number | null
}

export type MemberInvitedEvent = {
  event_id: string
  event_title: string
  starts_at: string
  ends_at: string | null
  location_name: string | null
  source_label: string
  host_token: string | null
  submission_id: string | null
}

export type CouncilInboxEvent = {
  event_id: string
  event_title: string
  starts_at: string
  ends_at: string | null
  location_name: string | null
  invite_email: string | null
  invite_contact_name: string | null
  host_token: string | null
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

function sortCouncilInboxEvents(left: CouncilInboxEvent, right: CouncilInboxEvent) {
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

export function getMemberInvitedEventHref(event: Pick<MemberInvitedEvent, 'host_token'>) {
  return event.host_token ? `/rsvp/${event.host_token}/event` : null
}

export function getCouncilInboxEventHref(event: Pick<CouncilInboxEvent, 'host_token'>) {
  return event.host_token ? `/rsvp/${event.host_token}/event` : null
}

export async function listMemberInvitedEvents(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
  limit?: number
}) {
  const { admin, permissions, limit = 12 } = args

  if (!permissions.authUser || permissions.canAccessMemberData) {
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

export async function listCouncilInboxEvents(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
  limit?: number
}) {
  const { admin, permissions, limit = 12 } = args

  const normalizedEmail = normalizeEmail(permissions.email)
  let councilNumber: string | null = null

  if (permissions.councilId) {
    const { data, error } = await admin
      .from('councils')
      .select('council_number')
      .eq('id', permissions.councilId)
      .maybeSingle<CouncilNumberRow>()

    if (error) {
      throw new Error(`Could not load council number for event inbox: ${error.message}`)
    }

    councilNumber = data?.council_number?.trim() ?? null
  }

  if (!councilNumber && !normalizedEmail) {
    return [] as CouncilInboxEvent[]
  }

  const filters: string[] = []
  if (councilNumber) {
    filters.push(`invited_council_number.eq.${councilNumber}`)
  }
  if (normalizedEmail) {
    filters.push(`invite_email.ilike.${normalizedEmail}`)
  }

  const { data: inviteRows, error: inviteError } = await admin
    .from('event_invited_councils')
    .select('event_id, invited_council_name, invited_council_number, invite_email, invite_contact_name, sort_order')
    .eq('is_host', false)
    .or(filters.join(','))
    .returns<CouncilInvitedEventRow[]>()

  if (inviteError) {
    throw new Error(`Could not load council inbox events: ${inviteError.message}`)
  }

  const uniqueEventIds = [...new Set((inviteRows ?? []).map((row) => row.event_id).filter(Boolean))]
  if (uniqueEventIds.length === 0) {
    return [] as CouncilInboxEvent[]
  }

  const [{ data: eventRows, error: eventsError }, { data: hostRows, error: hostError }] = await Promise.all([
    admin
      .from('events')
      .select('id, title, starts_at, ends_at, location_name, status_code')
      .in('id', uniqueEventIds)
      .not('status_code', 'in', '(cancelled,completed)')
      .returns<EventRow[]>(),
    admin
      .from('event_invited_councils')
      .select('event_id, rsvp_link_token')
      .eq('is_host', true)
      .in('event_id', uniqueEventIds)
      .returns<HostInviteRow[]>(),
  ])

  if (eventsError) {
    throw new Error(`Could not load council inbox event details: ${eventsError.message}`)
  }

  if (hostError) {
    throw new Error(`Could not load council inbox public links: ${hostError.message}`)
  }

  const eventById = new Map((eventRows ?? []).map((row) => [row.id, row]))
  const hostTokenByEventId = new Map((hostRows ?? []).map((row) => [row.event_id, row.rsvp_link_token]))
  const inviteByEventId = new Map<string, CouncilInvitedEventRow>()

  for (const row of (inviteRows ?? []).sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))) {
    if (!inviteByEventId.has(row.event_id)) {
      inviteByEventId.set(row.event_id, row)
    }
  }

  return uniqueEventIds
    .map((eventId) => {
      const event = eventById.get(eventId)
      const invite = inviteByEventId.get(eventId)
      if (!event || !invite) return null

      return {
        event_id: event.id,
        event_title: event.title,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        location_name: event.location_name,
        invite_email: invite.invite_email,
        invite_contact_name: invite.invite_contact_name,
        host_token: hostTokenByEventId.get(event.id) ?? null,
      } satisfies CouncilInboxEvent
    })
    .filter((row): row is CouncilInboxEvent => Boolean(row))
    .sort(sortCouncilInboxEvents)
    .slice(0, limit)
}
