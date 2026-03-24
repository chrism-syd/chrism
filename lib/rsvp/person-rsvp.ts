/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildHashForField } from '@/lib/security/pii';

export type PersonAttendeeInput = {
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  uses_primary_contact: boolean;
  sort_order: number;
};

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export async function findMatchingPersonIdByEmail(args: {
  supabase: SupabaseClient<any, 'public', any>;
  hostCouncilId: string;
  email: string | null;
}) {
  const { supabase, hostCouncilId, email } = args;

  if (!email) {
    return null;
  }

  const emailHash = buildHashForField('email', email);

  if (!emailHash) {
    return null;
  }

  const { data } = await supabase
    .from('people')
    .select('id')
    .eq('council_id', hostCouncilId)
    .or(`email_hash.eq.${emailHash},email.ilike.${email}`)
    .is('merged_into_person_id', null)
    .is('archived_at', null)
    .maybeSingle();

  return data?.id ?? null;
}

async function ensureNoDuplicateActiveSubmission(args: {
  supabase: SupabaseClient<any, 'public', any>;
  eventId: string;
  matchedPersonId: string | null;
  primaryEmail: string | null;
  existingSubmissionId?: string | null;
}) {
  const { supabase, eventId, matchedPersonId, primaryEmail, existingSubmissionId } = args;

  if (matchedPersonId) {
    const { data, error } = await supabase
      .from('event_person_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .eq('status_code', 'active')
      .eq('matched_person_id', matchedPersonId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not check for an existing RSVP: ${error.message}`);
    }

    if (data?.id && data.id !== existingSubmissionId) {
      throw new Error('This person is already on the volunteer list for this event.');
    }
  }

  if (primaryEmail) {
    const { data, error } = await supabase
      .from('event_person_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .eq('status_code', 'active')
      .ilike('primary_email', primaryEmail)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not check for an existing RSVP email: ${error.message}`);
    }

    if (data?.id && data.id !== existingSubmissionId) {
      throw new Error('An RSVP already exists for this email on this event.');
    }
  }
}

export async function savePersonRsvpSubmission(args: {
  supabase: SupabaseClient<any, 'public', any>;
  eventId: string;
  hostCouncilId: string;
  primaryName: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  responseNotes: string | null;
  attendees: PersonAttendeeInput[];
  sourceCode: 'host_manual' | 'email_link' | 'public_link';
  existingSubmissionId?: string | null;
  claimedByUserId?: string | null;
  explicitMatchedPersonId?: string | null;
}) {
  const {
    supabase,
    eventId,
    hostCouncilId,
    primaryName,
    primaryEmail,
    primaryPhone,
    responseNotes,
    attendees,
    sourceCode,
    existingSubmissionId,
    claimedByUserId,
    explicitMatchedPersonId,
  } = args;

  const normalizedPrimaryEmail = normalizeEmail(primaryEmail);
  const now = new Date().toISOString();
  const matchedPrimaryPersonId =
    explicitMatchedPersonId ??
    (await findMatchingPersonIdByEmail({
      supabase,
      hostCouncilId,
      email: normalizedPrimaryEmail,
    }));

  await ensureNoDuplicateActiveSubmission({
    supabase,
    eventId,
    matchedPersonId: matchedPrimaryPersonId,
    primaryEmail: normalizedPrimaryEmail,
    existingSubmissionId,
  });

  let submissionId = existingSubmissionId ?? null;

  if (!submissionId && normalizedPrimaryEmail) {
    const { data } = await supabase
      .from('event_person_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .eq('status_code', 'active')
      .ilike('primary_email', normalizedPrimaryEmail)
      .maybeSingle();

    submissionId = data?.id ?? null;
  }

  const submissionPayload: Record<string, unknown> = {
    matched_person_id: matchedPrimaryPersonId,
    primary_name: primaryName,
    primary_email: normalizedPrimaryEmail,
    primary_phone: primaryPhone,
    response_notes: responseNotes,
    source_code: sourceCode,
    status_code: 'active',
    last_responded_at: now,
  };

  if (claimedByUserId !== undefined) {
    submissionPayload.claimed_by_user_id = claimedByUserId;
    submissionPayload.claimed_at = claimedByUserId ? now : null;
  }

  if (submissionId) {
    const { data, error } = await supabase
      .from('event_person_rsvps')
      .update(submissionPayload)
      .eq('id', submissionId)
      .eq('event_id', eventId)
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Could not update RSVP: ${error?.message ?? 'Unknown error'}`);
    }

    submissionId = data.id;
  } else {
    const { data, error } = await supabase
      .from('event_person_rsvps')
      .insert({
        event_id: eventId,
        first_responded_at: now,
        cancelled_at: null,
        claimed_at: claimedByUserId ? now : null,
        claimed_by_user_id: claimedByUserId ?? null,
        ...submissionPayload,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Could not create RSVP: ${error?.message ?? 'Unknown error'}`);
    }

    submissionId = data.id;
  }

  const { error: deleteAttendeesError } = await supabase
    .from('event_person_rsvp_attendees')
    .delete()
    .eq('event_person_rsvp_id', submissionId);

  if (deleteAttendeesError) {
    throw new Error(`Could not refresh attendee rows: ${deleteAttendeesError.message}`);
  }

  const resolvedAttendees = await Promise.all(
    attendees.map(async (attendee) => {
      const attendeeEmail = attendee.uses_primary_contact
        ? normalizedPrimaryEmail
        : normalizeEmail(attendee.attendee_email);
      const attendeePhone = attendee.uses_primary_contact ? primaryPhone : attendee.attendee_phone;

      return {
        matched_person_id: await findMatchingPersonIdByEmail({
          supabase,
          hostCouncilId,
          email: attendeeEmail,
        }),
        attendee_name: attendee.attendee_name,
        attendee_email: attendeeEmail,
        attendee_phone: attendeePhone,
        uses_primary_contact: attendee.uses_primary_contact,
        sort_order: attendee.sort_order,
      };
    })
  );

  const attendeeRows = [
    {
      event_person_rsvp_id: submissionId,
      matched_person_id: matchedPrimaryPersonId,
      attendee_name: primaryName,
      attendee_email: normalizedPrimaryEmail,
      attendee_phone: primaryPhone,
      uses_primary_contact: true,
      is_primary: true,
      sort_order: 0,
    },
    ...resolvedAttendees.map((attendee) => ({
      event_person_rsvp_id: submissionId,
      matched_person_id: attendee.matched_person_id,
      attendee_name: attendee.attendee_name,
      attendee_email: attendee.attendee_email,
      attendee_phone: attendee.attendee_phone,
      uses_primary_contact: attendee.uses_primary_contact,
      is_primary: false,
      sort_order: attendee.sort_order,
    })),
  ];

  const { error: insertAttendeesError } = await supabase
    .from('event_person_rsvp_attendees')
    .insert(attendeeRows);

  if (insertAttendeesError) {
    throw new Error(`Could not save attendee rows: ${insertAttendeesError.message}`);
  }

  return {
    submissionId,
    matchedPrimaryPersonId,
  };
}
