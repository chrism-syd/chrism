/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildHashForField } from '@/lib/security/pii';

type ClaimReason = 'claimed' | 'submission' | 'primary_email' | 'attendee_email' | 'matched_person';

const CLAIM_REASON_PRIORITY: Record<ClaimReason, number> = {
  claimed: 5,
  submission: 4,
  primary_email: 3,
  attendee_email: 2,
  matched_person: 1,
};

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export type ClaimCandidate = {
  id: string;
  event_id: string;
  matched_person_id: string | null;
  claimed_by_user_id: string | null;
  primary_name: string;
  primary_email: string | null;
  primary_phone: string | null;
  response_notes: string | null;
  source_code: 'host_manual' | 'email_link' | 'public_link';
  status_code: 'active' | 'cancelled';
  first_responded_at: string;
  last_responded_at: string;
  claimed_at: string | null;
  cancelled_at: string | null;
  claim_reason: ClaimReason;
  attendees: Array<{
    id: string;
    event_person_rsvp_id: string;
    matched_person_id: string | null;
    attendee_name: string;
    attendee_email: string | null;
    attendee_phone: string | null;
    uses_primary_contact: boolean;
    is_primary: boolean;
    sort_order: number;
  }>;
};

async function loadCandidatesByIds(args: {
  supabase: SupabaseClient<any, 'public', any>;
  ids: string[];
}) {
  const { supabase, ids } = args;

  if (ids.length === 0) {
    return [] as ClaimCandidate[];
  }

  const { data: submissionsData, error: submissionsError } = await supabase
    .from('event_person_rsvps')
    .select(
      'id, event_id, matched_person_id, claimed_by_user_id, primary_name, primary_email, primary_phone, response_notes, source_code, status_code, first_responded_at, last_responded_at, claimed_at, cancelled_at'
    )
    .in('id', ids)
    .order('last_responded_at', { ascending: false });

  if (submissionsError) {
    throw new Error(`Could not load claim candidates: ${submissionsError.message}`);
  }

  const { data: attendeesData, error: attendeesError } = await supabase
    .from('event_person_rsvp_attendees')
    .select(
      'id, event_person_rsvp_id, matched_person_id, attendee_name, attendee_email, attendee_phone, uses_primary_contact, is_primary, sort_order'
    )
    .in('event_person_rsvp_id', ids)
    .order('sort_order', { ascending: true });

  if (attendeesError) {
    throw new Error(`Could not load claim attendees: ${attendeesError.message}`);
  }

  const attendeesBySubmissionId = new Map<string, ClaimCandidate['attendees']>();

  for (const attendee of (attendeesData as ClaimCandidate['attendees']) ?? []) {
    const existing = attendeesBySubmissionId.get(attendee.event_person_rsvp_id) ?? [];
    existing.push(attendee);
    attendeesBySubmissionId.set(attendee.event_person_rsvp_id, existing);
  }

  return ((submissionsData as Omit<ClaimCandidate, 'claim_reason' | 'attendees'>[]) ?? []).map(
    (submission) => ({
      ...submission,
      claim_reason: 'primary_email',
      attendees: attendeesBySubmissionId.get(submission.id) ?? [],
    })
  );
}

export async function listClaimablePersonRsvps(args: {
  supabase: SupabaseClient<any, 'public', any>;
  eventId: string;
  hostCouncilId: string;
  userId: string;
  email: string | null;
  submissionId?: string | null;
}) {
  const { supabase, eventId, hostCouncilId, userId, email, submissionId } = args;
  const normalizedEmail = normalizeEmail(email);
  const ids = new Map<string, ClaimReason>();

  function remember(id: string, reason: ClaimReason) {
    const existing = ids.get(id);

    if (!existing || CLAIM_REASON_PRIORITY[reason] > CLAIM_REASON_PRIORITY[existing]) {
      ids.set(id, reason);
    }
  }

  const { data: claimedRows, error: claimedError } = await supabase
    .from('event_person_rsvps')
    .select('id')
    .eq('event_id', eventId)
    .eq('status_code', 'active')
    .eq('claimed_by_user_id', userId);

  if (claimedError) {
    throw new Error(`Could not load your claimed RSVPs: ${claimedError.message}`);
  }

  for (const row of claimedRows ?? []) {
    remember(row.id as string, 'claimed');
  }

  if (submissionId) {
    const { data: submissionRow } = await supabase
      .from('event_person_rsvps')
      .select('id')
      .eq('id', submissionId)
      .eq('event_id', eventId)
      .eq('status_code', 'active')
      .maybeSingle();

    if (submissionRow?.id) {
      remember(submissionRow.id, 'submission');
    }
  }

  if (normalizedEmail) {
    const { data: primaryEmailRows, error: primaryEmailError } = await supabase
      .from('event_person_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .eq('status_code', 'active')
      .ilike('primary_email', normalizedEmail);

    if (primaryEmailError) {
      throw new Error(`Could not check primary email matches: ${primaryEmailError.message}`);
    }

    for (const row of primaryEmailRows ?? []) {
      remember(row.id as string, 'primary_email');
    }

    const { data: attendeeEmailRows, error: attendeeEmailError } = await supabase
      .from('event_person_rsvp_attendees')
      .select('event_person_rsvp_id')
      .ilike('attendee_email', normalizedEmail);

    if (attendeeEmailError) {
      throw new Error(`Could not check attendee email matches: ${attendeeEmailError.message}`);
    }

    for (const row of attendeeEmailRows ?? []) {
      remember(row.event_person_rsvp_id as string, 'attendee_email');
    }

    const peopleEmailHash = buildHashForField('email', normalizedEmail);

    const { data: personRows, error: personError } = peopleEmailHash
      ? await supabase
          .from('people')
          .select('id')
          .eq('council_id', hostCouncilId)
          .or(`email_hash.eq.${peopleEmailHash},email.ilike.${normalizedEmail}`)
          .is('merged_into_person_id', null)
          .is('archived_at', null)
      : { data: [], error: null };

    if (personError) {
      throw new Error(`Could not check member email matches: ${personError.message}`);
    }

    const personIds = (personRows ?? []).map((row) => row.id as string);

    if (personIds.length > 0) {
      const [{ data: matchedSubmissionRows, error: matchedSubmissionError }, { data: matchedAttendeeRows, error: matchedAttendeeError }] = await Promise.all([
        supabase
          .from('event_person_rsvps')
          .select('id')
          .eq('event_id', eventId)
          .eq('status_code', 'active')
          .in('matched_person_id', personIds),
        supabase
          .from('event_person_rsvp_attendees')
          .select('event_person_rsvp_id')
          .in('matched_person_id', personIds),
      ]);

      if (matchedSubmissionError) {
        throw new Error(`Could not check matched RSVP records: ${matchedSubmissionError.message}`);
      }

      if (matchedAttendeeError) {
        throw new Error(`Could not check matched attendee records: ${matchedAttendeeError.message}`);
      }

      for (const row of matchedSubmissionRows ?? []) {
        remember(row.id as string, 'matched_person');
      }

      for (const row of matchedAttendeeRows ?? []) {
        remember(row.event_person_rsvp_id as string, 'matched_person');
      }
    }
  }

  const candidateIds = [...ids.keys()];
  const hydrated = await loadCandidatesByIds({
    supabase,
    ids: candidateIds,
  });

  return hydrated
    .filter((candidate) => candidate.event_id === eventId && candidate.status_code === 'active')
    .map((candidate) => ({
      ...candidate,
      claim_reason: ids.get(candidate.id) ?? 'primary_email',
    }))
    .sort((left, right) => {
      const reasonDiff = CLAIM_REASON_PRIORITY[right.claim_reason] - CLAIM_REASON_PRIORITY[left.claim_reason];

      if (reasonDiff !== 0) {
        return reasonDiff;
      }

      return new Date(right.last_responded_at).getTime() - new Date(left.last_responded_at).getTime();
    });
}

export async function claimPersonRsvpSubmission(args: {
  supabase: SupabaseClient<any, 'public', any>;
  submissionId: string;
  userId: string;
}) {
  const { supabase, submissionId, userId } = args;

  const { data: existingData, error: existingError } = await supabase
    .from('event_person_rsvps')
    .select('id, claimed_by_user_id')
    .eq('id', submissionId)
    .maybeSingle();

  const existing = existingData as { id: string; claimed_by_user_id: string | null } | null;

  if (existingError || !existing) {
    throw new Error('Could not find that RSVP to claim.');
  }

  if (existing.claimed_by_user_id && existing.claimed_by_user_id !== userId) {
    throw new Error('This RSVP has already been secured by someone else.');
  }

  if (existing.claimed_by_user_id === userId) {
    return;
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('event_person_rsvps')
    .update({
      claimed_by_user_id: userId,
      claimed_at: now,
    })
    .eq('id', submissionId);

  if (error) {
    throw new Error(`Could not secure this RSVP: ${error.message}`);
  }
}

export async function listClaimedPersonRsvpsForUser(args: {
  supabase: SupabaseClient<any, 'public', any>;
  userId: string;
}) {
  const { supabase, userId } = args;

  const { data: submissionsData, error: submissionsError } = await supabase
    .from('event_person_rsvps')
    .select(
      'id, event_id, primary_name, primary_email, primary_phone, response_notes, source_code, status_code, claimed_at, last_responded_at'
    )
    .eq('claimed_by_user_id', userId)
    .order('last_responded_at', { ascending: false });

  if (submissionsError) {
    throw new Error(`Could not load your secured RSVPs: ${submissionsError.message}`);
  }

  const submissions =
    (submissionsData as Array<{
      id: string;
      event_id: string;
      primary_name: string;
      primary_email: string | null;
      primary_phone: string | null;
      response_notes: string | null;
      source_code: 'host_manual' | 'email_link' | 'public_link';
      status_code: 'active' | 'cancelled';
      claimed_at: string | null;
      last_responded_at: string;
    }>) ?? [];

  const eventIds = [...new Set(submissions.map((row) => row.event_id))];

  if (eventIds.length === 0) {
    return [] as Array<{
      id: string;
      event_id: string;
      primary_name: string;
      primary_email: string | null;
      primary_phone: string | null;
      response_notes: string | null;
      source_code: 'host_manual' | 'email_link' | 'public_link';
      status_code: 'active' | 'cancelled';
      claimed_at: string | null;
      last_responded_at: string;
      event_title: string;
      starts_at: string;
      ends_at: string;
      host_token: string | null;
    }>;
  }

  const [{ data: eventsData, error: eventsError }, { data: invitesData, error: invitesError }] =
    await Promise.all([
      supabase
        .from('events')
        .select('id, title, starts_at, ends_at')
        .in('id', eventIds),
      supabase
        .from('event_invited_councils')
        .select('event_id, rsvp_link_token')
        .eq('is_host', true)
        .in('event_id', eventIds),
    ]);

  if (eventsError) {
    throw new Error(`Could not load claimed events: ${eventsError.message}`);
  }

  if (invitesError) {
    throw new Error(`Could not load claimed event links: ${invitesError.message}`);
  }

  const eventById = new Map(
    ((eventsData as Array<{ id: string; title: string; starts_at: string; ends_at: string }>) ?? []).map(
      (event) => [event.id, event]
    )
  );
  const hostTokenByEventId = new Map(
    ((invitesData as Array<{ event_id: string; rsvp_link_token: string }>) ?? []).map((invite) => [
      invite.event_id,
      invite.rsvp_link_token,
    ])
  );

  return submissions.map((submission) => {
    const event = eventById.get(submission.event_id);

    return {
      ...submission,
      event_title: event?.title ?? 'Event',
      starts_at: event?.starts_at ?? submission.last_responded_at,
      ends_at: event?.ends_at ?? submission.last_responded_at,
      host_token: hostTokenByEventId.get(submission.event_id) ?? null,
    };
  });
}
