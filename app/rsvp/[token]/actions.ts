'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { claimPersonRsvpSubmission, listClaimablePersonRsvps } from '@/lib/rsvp/claim';
import { loadPublicInviteContext } from '@/lib/rsvp/public';
import { savePersonRsvpSubmission, type PersonAttendeeInput } from '@/lib/rsvp/person-rsvp';

function normalizeString(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function nullableString(value: FormDataEntryValue | string | null | undefined) {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeEmail(value: FormDataEntryValue | string | null | undefined) {
  const normalized = nullableString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function parseBoolean(value: FormDataEntryValue | string | null | undefined) {
  return value === 'true' || value === 'on' || value === '1';
}

function parsePersonAttendeeRows(formData: FormData) {
  const names = formData.getAll('attendee_name[]').map((value) => normalizeString(value));
  const emails = formData.getAll('attendee_email[]').map((value) => normalizeEmail(value));
  const phones = formData.getAll('attendee_phone[]').map((value) => nullableString(value));

  const rowCount = Math.max(names.length, emails.length, phones.length);
  const rows: PersonAttendeeInput[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const attendeeName = names[index] ?? '';
    const attendeeEmail = emails[index] ?? null;
    const attendeePhone = phones[index] ?? null;
    const usesPrimaryContact = parseBoolean(formData.get(`attendee_use_primary_contact_${index}`));
    const removeRow = parseBoolean(formData.get(`attendee_remove_${index}`));

    if (removeRow) {
      continue;
    }

    const hasAnyValue = attendeeName.length > 0 || !!attendeeEmail || !!attendeePhone;

    if (!hasAnyValue) {
      continue;
    }

    if (!attendeeName) {
      throw new Error('Each additional attendee needs a name.');
    }

    rows.push({
      attendee_name: attendeeName,
      attendee_email: attendeeEmail,
      attendee_phone: attendeePhone,
      uses_primary_contact: usesPrimaryContact,
      sort_order: rows.length + 1,
    });
  }

  return rows;
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Please confirm your email before managing this RSVP.');
  }

  return { supabase, user };
}

function buildManageUrl(token: string, submissionId?: string | null, saved?: boolean) {
  const params = new URLSearchParams();

  if (submissionId) {
    params.set('submission', submissionId);
  }

  if (saved) {
    params.set('saved', '1');
  }

  const query = params.toString();
  return `/rsvp/${token}/manage${query ? `?${query}` : ''}`;
}

export async function claimPersonRsvpAction(token: string, submissionId: string) {
  const { user } = await getAuthenticatedUser();
  const supabase = createAdminClient();

  const context = await loadPublicInviteContext(supabase, token);

  if (!context || context.event.scope_code !== 'home_council_only') {
    throw new Error('This RSVP cannot be claimed from this link.');
  }

  const candidates = await listClaimablePersonRsvps({
    supabase,
    eventId: context.event.id,
    hostCouncilId: context.event.host_council_id,
    userId: user.id,
    email: user.email ?? null,
    submissionId,
  });

  const candidate = candidates.find((row) => row.id === submissionId);

  if (!candidate) {
    throw new Error('We could not find a matching RSVP to secure.');
  }

  await claimPersonRsvpSubmission({
    supabase,
    submissionId: candidate.id,
    userId: user.id,
  });

  revalidatePath(`/rsvp/${token}`);
  revalidatePath(`/rsvp/${token}/event`);
  revalidatePath(`/rsvp/${token}/manage`);
  revalidatePath('/me');
  revalidatePath(`/events/${context.event.id}`);
  revalidatePath(`/events/${context.event.id}/volunteers`);

  redirect(buildManageUrl(token, candidate.id));
}

export async function saveClaimedPersonRsvpAction(token: string, submissionId: string, formData: FormData) {
  const { user } = await getAuthenticatedUser();
  const supabase = createAdminClient();

  const context = await loadPublicInviteContext(supabase, token);

  if (!context || context.event.scope_code !== 'home_council_only') {
    throw new Error('This RSVP cannot be updated from this link.');
  }

  const candidates = await listClaimablePersonRsvps({
    supabase,
    eventId: context.event.id,
    hostCouncilId: context.event.host_council_id,
    userId: user.id,
    email: user.email ?? null,
    submissionId,
  });

  const candidate = candidates.find((row) => row.id === submissionId);

  if (!candidate) {
    throw new Error('We could not find that RSVP.');
  }

  if (candidate.claimed_by_user_id && candidate.claimed_by_user_id !== user.id) {
    throw new Error('This RSVP has already been secured by someone else.');
  }

  await claimPersonRsvpSubmission({
    supabase,
    submissionId: candidate.id,
    userId: user.id,
  });

  const primaryName = normalizeString(formData.get('primary_name'));
  const primaryEmail = normalizeEmail(formData.get('primary_email'));
  const primaryPhone = nullableString(formData.get('primary_phone'));
  const responseNotes = nullableString(formData.get('response_notes'));
  const attendees = parsePersonAttendeeRows(formData);

  if (!primaryName) {
    throw new Error('Your name is required.');
  }

  if (!primaryEmail) {
    throw new Error('Your email is required.');
  }

  const result = await savePersonRsvpSubmission({
    supabase,
    eventId: context.event.id,
    hostCouncilId: context.event.host_council_id,
    primaryName,
    primaryEmail,
    primaryPhone,
    responseNotes,
    attendees,
    sourceCode: candidate.source_code,
    existingSubmissionId: candidate.id,
    claimedByUserId: user.id,
  });

  revalidatePath(`/rsvp/${token}`);
  revalidatePath(`/rsvp/${token}/event`);
  revalidatePath(`/rsvp/${token}/manage`);
  revalidatePath('/me');
  revalidatePath(`/events/${context.event.id}`);
  revalidatePath(`/events/${context.event.id}/volunteers`);

  redirect(buildManageUrl(token, result.submissionId, true));
}
