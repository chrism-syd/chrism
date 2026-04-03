'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentActingCouncilContext, getCurrentActingCouncilContextForEvent } from '@/lib/auth/acting-context';
import { savePersonRsvpSubmission } from '@/lib/rsvp/person-rsvp';
import { decryptPeopleRecord, protectPeoplePayload } from '@/lib/security/pii';

const DEFAULT_TIME_ZONE = 'America/Toronto';

type CouncilRow = {
  id: string;
  name: string | null;
  council_number: string | null;
};

type EventRow = {
  id: string;
  council_id: string;
  status_code: 'draft' | 'scheduled' | 'completed' | 'cancelled';
  title: string;
  description: string | null;
  location_name: string | null;
  location_address: string | null;
  starts_at: string;
  ends_at: string;
  scope_code: 'home_council_only' | 'multi_council';
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting';
  requires_rsvp: boolean;
  needs_volunteers: boolean;
  rsvp_deadline_at: string | null;
  reminder_enabled: boolean;
  reminder_scheduled_for: string | null;
  reminder_days_before: number | null;
};

type InviteDraft = {
  invited_council_name: string;
  invited_council_number: string | null;
  invite_email: string | null;
  invite_contact_name: string | null;
};

type EventInviteRow = {
  id: string;
  event_id: string;
  is_host: boolean;
  rsvp_link_token: string;
};

type ExistingRsvpRow = {
  id: string;
};

type PersonAttendeeInput = {
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  uses_primary_contact: boolean;
  sort_order: number;
};

type AdminClient = ReturnType<typeof createAdminClient>;

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

function assertPeopleContactRequirement(args: {
  email: string | null;
  cellPhone: string | null;
  homePhone?: string | null;
  otherPhone?: string | null;
  contextLabel: string;
}) {
  const { email, cellPhone, homePhone = null, otherPhone = null, contextLabel } = args;

  if ([email, cellPhone, homePhone, otherPhone].some((value) => Boolean(value && value.trim()))) {
    return;
  }

  throw new Error(
    `${contextLabel} needs at least one contact method on file: email, cell phone, home phone, or other phone.`
  );
}

function normalizeEmail(value: FormDataEntryValue | string | null | undefined) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function parseBoolean(value: FormDataEntryValue | string | null | undefined) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'true' || normalized === 'on' || normalized === '1' || normalized === 'yes';
}

function getArray(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => normalizeString(value));
}

function makeToken() {
  return `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
}

function getBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL;

  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return '';
}

function buildRsvpUrl(token: string) {
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}/rsvp/${token}` : `/rsvp/${token}`;
}

function buildRsvpResultUrl(args: {
  token: string;
  flow: 'person' | 'council';
  submissionId?: string | null;
  revoked?: boolean;
}) {
  const params = new URLSearchParams();
  params.set('flow', args.flow);

  if (args.revoked) {
    params.set('revoked', '1');
  } else {
    params.set('saved', '1');
  }

  if (args.submissionId) {
    params.set('submission', args.submissionId);
  }

  return `/rsvp/${args.token}?${params.toString()}`;
}

function formatEventDateForEmail(isoString: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoString));
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);

  const getPart = (type: string) => {
    const match = parts.find((part) => part.type === type)?.value;
    return match ? Number(match) : 0;
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
}

function localInputToTzIso(localInput: string | null, timeZone = DEFAULT_TIME_ZONE) {
  if (!localInput) {
    return null;
  }

  const [datePart, timePart] = localInput.split('T');
  if (!datePart || !timePart) {
    return null;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) {
    return null;
  }

  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = getZonedParts(guess, timeZone);
    const desiredUtcMinutes = Date.UTC(year, month - 1, day, hour, minute, 0) / 60000;
    const zonedUtcMinutes =
      Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second) /
      60000;
    const diffMinutes = desiredUtcMinutes - zonedUtcMinutes;

    if (diffMinutes === 0) {
      break;
    }

    guess = new Date(guess.getTime() + diffMinutes * 60000);
  }

  return guess.toISOString();
}


function parseInvitedCouncils(formData: FormData) {
  const names = getArray(formData, 'invited_council_name[]');
  const numbers = getArray(formData, 'invited_council_number[]');
  const emails = getArray(formData, 'invite_email[]');
  const contacts = getArray(formData, 'invite_contact_name[]');

  const rowCount = Math.max(names.length, numbers.length, emails.length, contacts.length);
  const rows: InviteDraft[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const row: InviteDraft = {
      invited_council_name: names[index] ?? '',
      invited_council_number: nullableString(numbers[index] ?? ''),
      invite_email: nullableString(emails[index] ?? ''),
      invite_contact_name: nullableString(contacts[index] ?? ''),
    };

    const hasAnyValue =
      row.invited_council_name.length > 0 ||
      !!row.invited_council_number ||
      !!row.invite_email ||
      !!row.invite_contact_name;

    if (!hasAnyValue) {
      continue;
    }

    if (!row.invited_council_name) {
      throw new Error('Each invited council row needs a council name.');
    }

    rows.push(row);
  }

  return rows;
}

function parseExternalInvitees(formData: FormData) {
  const names = getArray(formData, 'invitee_name[]');
  const emails = getArray(formData, 'invitee_email[]');
  const phones = getArray(formData, 'invitee_phone[]');
  const roles = getArray(formData, 'invitee_role_label[]');
  const notes = getArray(formData, 'invitee_notes[]');

  const rowCount = Math.max(names.length, emails.length, phones.length, roles.length, notes.length);
  const rows: Array<{
    invitee_name: string;
    invitee_email: string | null;
    invitee_phone: string | null;
    invitee_role_label: string | null;
    notes: string | null;
    sort_order: number;
  }> = [];

  for (let index = 0; index < rowCount; index += 1) {
    const inviteeName = names[index] ?? '';
    const inviteeEmail = normalizeEmail(emails[index] ?? '');
    const inviteePhone = nullableString(phones[index] ?? '');
    const inviteeRoleLabel = nullableString(roles[index] ?? '');
    const inviteeNotes = nullableString(notes[index] ?? '');

    const hasAnyValue =
      inviteeName.length > 0 ||
      !!inviteeEmail ||
      !!inviteePhone ||
      !!inviteeRoleLabel ||
      !!inviteeNotes;

    if (!hasAnyValue) {
      continue;
    }

    if (!inviteeName) {
      throw new Error('Each guest invitee row needs a name.');
    }

    rows.push({
      invitee_name: inviteeName,
      invitee_email: inviteeEmail,
      invitee_phone: inviteePhone,
      invitee_role_label: inviteeRoleLabel,
      notes: inviteeNotes,
      sort_order: rows.length,
    });
  }

  return rows;
}

function parseVolunteerRows(formData: FormData) {
  const names = getArray(formData, 'volunteer_name[]');
  const emails = getArray(formData, 'volunteer_email[]');
  const phones = getArray(formData, 'volunteer_phone[]');
  const notes = getArray(formData, 'volunteer_notes[]');

  const rowCount = Math.max(names.length, emails.length, phones.length, notes.length);
  const rows: Array<{
    volunteer_name: string;
    volunteer_email: string | null;
    volunteer_phone: string | null;
    volunteer_notes: string | null;
    sort_order: number;
  }> = [];

  for (let index = 0; index < rowCount; index += 1) {
    const removeRow = parseBoolean(formData.get(`volunteer_remove_${index}`));

    if (removeRow) {
      continue;
    }

    const volunteerName = names[index] ?? '';
    const volunteerEmail = nullableString(emails[index] ?? '');
    const volunteerPhone = nullableString(phones[index] ?? '');
    const volunteerNotes = nullableString(notes[index] ?? '');

    const hasAnyValue =
      volunteerName.length > 0 || !!volunteerEmail || !!volunteerPhone || !!volunteerNotes;

    if (!hasAnyValue) {
      continue;
    }

    if (!volunteerName) {
      throw new Error('Each volunteer row needs a volunteer name.');
    }

    rows.push({
      volunteer_name: volunteerName,
      volunteer_email: volunteerEmail,
      volunteer_phone: volunteerPhone,
      volunteer_notes: volunteerNotes,
      sort_order: rows.length,
    });
  }

  return rows;
}

function parsePersonAttendeeRows(formData: FormData) {
  const names = getArray(formData, 'attendee_name[]');
  const emails = getArray(formData, 'attendee_email[]');
  const phones = getArray(formData, 'attendee_phone[]');

  const rowCount = Math.max(names.length, emails.length, phones.length);
  const rows: PersonAttendeeInput[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const removeRow = parseBoolean(formData.get(`attendee_remove_${index}`));

    if (removeRow) {
      continue;
    }

    const attendeeName = names[index] ?? '';
    const attendeeEmail = normalizeEmail(emails[index] ?? '');
    const attendeePhone = nullableString(phones[index] ?? '');
    const usesPrimaryContact = parseBoolean(formData.get(`attendee_use_primary_contact_${index}`));

    const hasAnyValue = attendeeName.length > 0 || !!attendeeEmail || !!attendeePhone;

    if (!hasAnyValue) {
      continue;
    }

    if (!attendeeName) {
      throw new Error('Each additional person needs a name.');
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

function buildEventPayload(formData: FormData) {
  const rawTitle = normalizeString(formData.get('title'));
  const startsAt = localInputToTzIso(normalizeString(formData.get('starts_at')));
  const endsAt = localInputToTzIso(normalizeString(formData.get('ends_at')));
  const scopeCode =
    normalizeString(formData.get('scope_code')) === 'multi_council'
      ? 'multi_council'
      : 'home_council_only';
  const eventKindCode =
    normalizeString(formData.get('event_kind_code')) === 'general_meeting'
      ? 'general_meeting'
      : normalizeString(formData.get('event_kind_code')) === 'executive_meeting'
        ? 'executive_meeting'
        : 'standard';
  const requiresRsvp = parseBoolean(formData.get('requires_rsvp'));
  const needsVolunteers = parseBoolean(formData.get('needs_volunteers'));
  const reminderEnabled = parseBoolean(formData.get('reminder_enabled'));
  const reminderDaysBeforeValue = nullableString(formData.get('reminder_days_before'));
  const reminderDaysBefore = reminderDaysBeforeValue ? Number(reminderDaysBeforeValue) : null;

  const rsvpDeadlineAt = requiresRsvp
    ? localInputToTzIso(normalizeString(formData.get('rsvp_deadline_at')))
    : null;

  const reminderScheduledFor = reminderEnabled
    ? localInputToTzIso(normalizeString(formData.get('reminder_scheduled_for')))
    : null;

  const title =
    rawTitle ||
    (eventKindCode === 'executive_meeting'
      ? 'Executive Meeting'
      : eventKindCode === 'general_meeting'
        ? 'General Meeting'
        : '');

  if (!title) {
    throw new Error('Event title is required.');
  }

  if (!startsAt || !endsAt) {
    throw new Error('Start and end time are required.');
  }

  if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    throw new Error('End time must be after the start time.');
  }

  if (rsvpDeadlineAt && new Date(rsvpDeadlineAt).getTime() > new Date(startsAt).getTime()) {
    throw new Error('RSVP deadline must be before the event start.');
  }

  if (
    reminderScheduledFor &&
    new Date(reminderScheduledFor).getTime() >= new Date(startsAt).getTime()
  ) {
    throw new Error('Reminder time must be before the event start.');
  }

  if (
    reminderDaysBefore != null &&
    (!Number.isInteger(reminderDaysBefore) || reminderDaysBefore < 0 || reminderDaysBefore > 60)
  ) {
    throw new Error('Meeting reminder days must be a whole number between 0 and 60.');
  }

  return {
    title,
    description: nullableString(formData.get('description')),
    location_name: nullableString(formData.get('location_name')),
    location_address: nullableString(formData.get('location_address')),
    starts_at: startsAt,
    ends_at: endsAt,
    scope_code: scopeCode as 'home_council_only' | 'multi_council',
    event_kind_code: eventKindCode as 'standard' | 'general_meeting' | 'executive_meeting',
    requires_rsvp: requiresRsvp,
    needs_volunteers: needsVolunteers,
    rsvp_deadline_at: rsvpDeadlineAt,
    reminder_enabled: reminderEnabled,
    reminder_scheduled_for: reminderScheduledFor,
    reminder_days_before: reminderDaysBefore,
    display_timezone: DEFAULT_TIME_ZONE,
  };
}

async function getCurrentAppContext(options?: { eventId?: string; redirectTo?: string }) {
  const { admin, permissions, council } = options?.eventId
    ? await getCurrentActingCouncilContextForEvent({
        eventId: options.eventId,
        redirectTo: options.redirectTo ?? '/events',
      })
    : await getCurrentActingCouncilContext({
        redirectTo: options?.redirectTo ?? '/me',
        areaCode: 'events',
        minimumAccessLevel: 'manage',
      });

  if (!permissions.appUser?.id || !permissions.authUser) {
    throw new Error('Could not load your council context.');
  }

  return {
    supabase: admin,
    user: permissions.authUser,
    appUser: { id: permissions.appUser.id },
    council: {
      id: council.id,
      name: council.name,
      council_number: council.council_number,
    } satisfies CouncilRow,
  };
}

async function ensureHostInvite(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
  council: CouncilRow;
}) {
  const { supabase, eventId, council } = args;

  const { data: existingHostInviteData } = await supabase
    .from('event_invited_councils')
    .select('id, event_id, is_host, rsvp_link_token')
    .eq('event_id', eventId)
    .eq('is_host', true)
    .maybeSingle();

  const existingHostInvite = existingHostInviteData as EventInviteRow | null;

  if (existingHostInvite?.id) {
    const { error } = await supabase
      .from('event_invited_councils')
      .update({
        invited_council_type_code: 'host_council',
        invited_council_id: council.id,
        invited_council_name: council.name ?? 'Host Council',
        invited_council_number: council.council_number,
        is_host: true,
        sort_order: 0,
      })
      .eq('id', existingHostInvite.id);

    if (error) {
      throw new Error(`Could not update host council invite row: ${error.message}`);
    }

    return existingHostInvite;
  }

  const { data, error } = await supabase
    .from('event_invited_councils')
    .insert({
      event_id: eventId,
      invited_council_type_code: 'host_council',
      invited_council_id: council.id,
      invited_council_name: council.name ?? 'Host Council',
      invited_council_number: council.council_number,
      invite_email: null,
      invite_contact_name: null,
      is_host: true,
      rsvp_link_token: makeToken(),
      sort_order: 0,
    })
    .select('id, event_id, is_host, rsvp_link_token')
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create host council invite row: ${error?.message ?? 'Unknown error'}`
    );
  }

  return data as EventInviteRow;
}

async function replaceNonHostInvites(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
  invitedCouncils: InviteDraft[];
}) {
  const { supabase, eventId, invitedCouncils } = args;

  const { data: existingInvites, error: existingInvitesError } = await supabase
    .from('event_invited_councils')
    .select('id')
    .eq('event_id', eventId)
    .eq('is_host', false);

  if (existingInvitesError) {
    throw new Error(`Could not read existing invite rows: ${existingInvitesError.message}`);
  }

  const existingInviteIds = (existingInvites ?? []).map((row: { id: string }) => row.id);

  if (existingInviteIds.length > 0) {
    const { data: existingResponses, error: existingResponsesError } = await supabase
      .from('event_council_rsvps')
      .select('id')
      .in('event_invited_council_id', existingInviteIds)
      .limit(1)
      .returns<ExistingRsvpRow[]>();

    if (existingResponsesError) {
      throw new Error(
        `Could not verify existing RSVP responses: ${existingResponsesError.message}`
      );
    }

    if ((existingResponses ?? []).length > 0) {
      throw new Error(
        'This event already has RSVP responses for invited councils. Editing invited councils after responses begin is locked in v1.'
      );
    }

    const { error: deleteError } = await supabase
      .from('event_invited_councils')
      .delete()
      .in('id', existingInviteIds);

    if (deleteError) {
      throw new Error(`Could not replace invited councils: ${deleteError.message}`);
    }
  }

  if (invitedCouncils.length === 0) {
    return;
  }

  const rows = invitedCouncils.map((invite, index) => ({
    event_id: eventId,
    invited_council_type_code: 'external_council',
    invited_council_id: null,
    invited_council_name: invite.invited_council_name,
    invited_council_number: invite.invited_council_number,
    invite_email: invite.invite_email,
    invite_contact_name: invite.invite_contact_name,
    is_host: false,
    rsvp_link_token: makeToken(),
    sort_order: index + 1,
  }));

  const { error } = await supabase.from('event_invited_councils').insert(rows);

  if (error) {
    throw new Error(`Could not save invited councils: ${error.message}`);
  }
}


async function replaceEventExternalInvitees(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
  invitees: Array<{
    invitee_name: string;
    invitee_email: string | null;
    invitee_phone: string | null;
    invitee_role_label: string | null;
    notes: string | null;
    sort_order: number;
  }>;
  userId: string;
}) {
  const { supabase, eventId, invitees, userId } = args;

  const { error: deleteError } = await supabase
    .from('event_external_invitees')
    .delete()
    .eq('event_id', eventId);

  if (deleteError) {
    throw new Error(`Could not refresh external invitees: ${deleteError.message}`);
  }

  if (invitees.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from('event_external_invitees').insert(
    invitees.map((invitee) => ({
      event_id: eventId,
      invitee_name: invitee.invitee_name,
      invitee_email: invitee.invitee_email,
      invitee_phone: invitee.invitee_phone,
      invitee_role_label: invitee.invitee_role_label,
      notes: invitee.notes,
      sort_order: invitee.sort_order,
      created_by_user_id: userId,
      updated_by_user_id: userId,
    }))
  );

  if (insertError) {
    throw new Error(`Could not save external invitees: ${insertError.message}`);
  }
}

function buildInvitationMessage(args: {
  event: EventRow;
  invite: {
    invited_council_name: string;
    invite_email: string | null;
    rsvp_link_token: string;
  };
}) {
  const { event, invite } = args;
  const rsvpUrl = buildRsvpUrl(invite.rsvp_link_token);
  const eventDate = formatEventDateForEmail(event.starts_at);

  return {
    subject: `Volunteer RSVP for ${event.title}`,
    body_text: [
      `Hello ${invite.invited_council_name},`,
      '',
      `You have been invited to respond for ${event.title}.`,
      `Date: ${eventDate}`,
      event.location_name ? `Location: ${event.location_name}` : null,
      event.location_address ? `Address: ${event.location_address}` : null,
      '',
      'Please use this council RSVP link:',
      rsvpUrl,
      '',
      event.rsvp_deadline_at
        ? `RSVP deadline: ${formatEventDateForEmail(event.rsvp_deadline_at)}`
        : null,
      '',
      'This link can be shared within your council and reused to update your response.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function buildReminderMessage(args: {
  event: EventRow;
  invite: {
    invited_council_name: string;
    invite_email: string | null;
    rsvp_link_token: string;
  };
}) {
  const { event, invite } = args;
  const rsvpUrl = buildRsvpUrl(invite.rsvp_link_token);
  const eventDate = formatEventDateForEmail(event.starts_at);

  if (event.requires_rsvp) {
    return {
      subject: `Reminder: ${event.title} RSVP / update`,
      body_text: [
        `Hello ${invite.invited_council_name},`,
        '',
        `This is a reminder for ${event.title} on ${eventDate}.`,
        'Thank you if you have already responded. If not, please use the link below.',
        'If your volunteer count has changed, you can use the same link to update your response.',
        '',
        rsvpUrl,
        '',
        event.rsvp_deadline_at
          ? `RSVP deadline: ${formatEventDateForEmail(event.rsvp_deadline_at)}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  return {
    subject: `Reminder: ${event.title}`,
    body_text: [
      `Hello ${invite.invited_council_name},`,
      '',
      `This is a reminder for ${event.title} on ${eventDate}.`,
      event.location_name ? `Location: ${event.location_name}` : null,
      event.location_address ? `Address: ${event.location_address}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

async function loadHostInviteForEvent(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
}) {
  const { supabase, eventId } = args;

  const { data, error } = await supabase
    .from('event_invited_councils')
    .select('id, invited_council_name, rsvp_link_token')
    .eq('event_id', eventId)
    .eq('is_host', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load host invite row: ${error.message}`);
  }

  return (data as { id: string; invited_council_name: string; rsvp_link_token: string } | null) ?? null;
}

function buildVolunteerConfirmationMessage(args: { event: EventRow; volunteerName: string }) {
  const { event, volunteerName } = args;
  const eventDate = formatEventDateForEmail(event.starts_at);

  return {
    subject: `You are on the volunteer list for ${event.title}`,
    body_text: [
      `Hello ${volunteerName},`,
      '',
      `This is a confirmation that you are on the volunteer list for ${event.title}.`,
      `Date: ${eventDate}`,
      event.location_name ? `Location: ${event.location_name}` : null,
      event.location_address ? `Address: ${event.location_address}` : null,
      '',
      'If something changes, please contact the event organizer.',
    ].filter(Boolean).join('\n'),
  };
}

function buildVolunteerRemovalMessage(args: { event: EventRow; volunteerName: string }) {
  const { event, volunteerName } = args;
  const eventDate = formatEventDateForEmail(event.starts_at);

  return {
    subject: `You were removed from ${event.title}`,
    body_text: [
      `Hello ${volunteerName},`,
      '',
      `An organizer removed your volunteer entry for ${event.title}.`,
      `Date: ${eventDate}`,
      event.location_name ? `Location: ${event.location_name}` : null,
      event.location_address ? `Address: ${event.location_address}` : null,
      '',
      'If this was unexpected, please contact the event organizer.',
    ].filter(Boolean).join('\n'),
  };
}

function buildVolunteerReminderMessage(args: { event: EventRow; volunteerName: string }) {
  const { event, volunteerName } = args;
  const eventDate = formatEventDateForEmail(event.starts_at);

  return {
    subject: `Reminder: ${event.title}`,
    body_text: [
      `Hello ${volunteerName},`,
      '',
      `This is a reminder that you are on the volunteer list for ${event.title}.`,
      `Date: ${eventDate}`,
      event.location_name ? `Location: ${event.location_name}` : null,
      event.location_address ? `Address: ${event.location_address}` : null,
    ].filter(Boolean).join('\n'),
  };
}

async function queueVolunteerMessageJob(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  event: EventRow;
  createdByUserId: string | null;
  recipientEmail: string | null;
  recipientName: string;
  messageTypeCode: 'volunteer_confirmation' | 'volunteer_removed' | 'volunteer_reminder';
  scheduledFor?: string | null;
}) {
  const { supabase, event, createdByUserId, recipientEmail, recipientName, messageTypeCode, scheduledFor } = args;
  const normalizedRecipientEmail = normalizeEmail(recipientEmail);

  if (!normalizedRecipientEmail) {
    return;
  }

  const hostInvite = await loadHostInviteForEvent({ supabase, eventId: event.id });

  if (!hostInvite?.id) {
    return;
  }

  const message =
    messageTypeCode === 'volunteer_confirmation'
      ? buildVolunteerConfirmationMessage({ event, volunteerName: recipientName })
      : messageTypeCode === 'volunteer_removed'
        ? buildVolunteerRemovalMessage({ event, volunteerName: recipientName })
        : buildVolunteerReminderMessage({ event, volunteerName: recipientName });

  const { error } = await supabase.from('event_message_jobs').insert({
    event_id: event.id,
    event_invited_council_id: hostInvite.id,
    message_type_code: messageTypeCode,
    status_code: 'pending',
    recipient_email: normalizedRecipientEmail,
    recipient_name: recipientName,
    subject: message.subject,
    body_text: message.body_text,
    body_html: null,
    payload_snapshot: {
      event_title: event.title,
      starts_at: event.starts_at,
      volunteer_name: recipientName,
      message_kind: messageTypeCode,
    },
    scheduled_for: scheduledFor ?? new Date().toISOString(),
    created_by_user_id: createdByUserId,
  });

  if (error) {
    throw new Error(`Could not queue volunteer email: ${error.message}`);
  }
}

async function replaceVolunteerReminderJob(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  event: EventRow;
  createdByUserId: string | null;
  recipientEmail: string | null;
  recipientName: string;
}) {
  const { supabase, event, createdByUserId, recipientEmail, recipientName } = args;
  const normalizedRecipientEmail = normalizeEmail(recipientEmail);

  if (!normalizedRecipientEmail) {
    return;
  }

  const hostInvite = await loadHostInviteForEvent({ supabase, eventId: event.id });

  if (!hostInvite?.id) {
    return;
  }

  const { error: cancelError } = await supabase
    .from('event_message_jobs')
    .update({ status_code: 'cancelled' })
    .eq('event_id', event.id)
    .eq('event_invited_council_id', hostInvite.id)
    .eq('message_type_code', 'volunteer_reminder')
    .eq('status_code', 'pending')
    .ilike('recipient_email', normalizedRecipientEmail);

  if (cancelError) {
    throw new Error(`Could not refresh volunteer reminder email: ${cancelError.message}`);
  }

  if (!event.reminder_enabled || !event.reminder_scheduled_for) {
    return;
  }

  if (new Date(event.reminder_scheduled_for).getTime() <= Date.now()) {
    return;
  }

  await queueVolunteerMessageJob({
    supabase,
    event,
    createdByUserId,
    recipientEmail: normalizedRecipientEmail,
    recipientName,
    messageTypeCode: 'volunteer_reminder',
    scheduledFor: event.reminder_scheduled_for,
  });
}


async function cancelPendingVolunteerMessageJobs(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
  recipientEmail: string | null;
}) {
  const { supabase, eventId, recipientEmail } = args;
  const normalizedRecipientEmail = normalizeEmail(recipientEmail);

  if (!normalizedRecipientEmail) {
    return;
  }

  const { error } = await supabase
    .from('event_message_jobs')
    .update({ status_code: 'cancelled' })
    .eq('event_id', eventId)
    .eq('status_code', 'pending')
    .in('message_type_code', ['volunteer_confirmation', 'volunteer_reminder'])
    .ilike('recipient_email', normalizedRecipientEmail);

  if (error) {
    throw new Error(`Could not clear volunteer message jobs: ${error.message}`);
  }
}

async function createDraftEventFromSeed(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  council: CouncilRow;
  userId: string;
  seed: {
    title: string;
    description: string | null;
    location_name: string | null;
    location_address: string | null;
    starts_at: string;
    ends_at: string;
    scope_code: 'home_council_only' | 'multi_council';
    event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting';
    requires_rsvp: boolean;
    needs_volunteers: boolean;
    rsvp_deadline_at: string | null;
    reminder_enabled: boolean;
    reminder_scheduled_for: string | null;
    reminder_days_before: number | null;
  };
  invitedCouncils?: InviteDraft[];
  externalInvitees?: Array<{
    invitee_name: string;
    invitee_email: string | null;
    invitee_phone: string | null;
    invitee_role_label: string | null;
    notes: string | null;
    sort_order: number;
  }>;
}) {
  const { supabase, council, userId, seed, invitedCouncils = [], externalInvitees = [] } = args;

  const eventId = crypto.randomUUID();

  const { error } = await supabase.from('events').insert({
    id: eventId,
    council_id: council.id,
    title: seed.title,
    description: seed.description,
    location_name: seed.location_name,
    location_address: seed.location_address,
    starts_at: seed.starts_at,
    ends_at: seed.ends_at,
    display_timezone: DEFAULT_TIME_ZONE,
    status_code: 'draft',
    scope_code: seed.scope_code,
    event_kind_code: seed.event_kind_code,
    requires_rsvp: seed.requires_rsvp,
    needs_volunteers: seed.needs_volunteers,
    rsvp_deadline_at: seed.rsvp_deadline_at,
    reminder_enabled: seed.reminder_enabled,
    reminder_scheduled_for: seed.reminder_scheduled_for,
    reminder_days_before: seed.reminder_days_before,
    created_by_user_id: userId,
    updated_by_user_id: userId,
  });

  if (error) {
    throw new Error(`Could not duplicate event into a draft: ${error.message}`);
  }

  await ensureHostInvite({
    supabase,
    eventId,
    council,
  });

  await replaceNonHostInvites({
    supabase,
    eventId,
    invitedCouncils: seed.scope_code === 'multi_council' ? invitedCouncils : [],
  });

  await replaceEventExternalInvitees({
    supabase,
    eventId,
    invitees: externalInvitees,
    userId,
  });

  revalidatePath('/events');
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/edit`);

  return eventId;
}

async function cancelPendingMessageJobs(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
}) {
  const { supabase, eventId } = args;

  const { error } = await supabase
    .from('event_message_jobs')
    .update({ status_code: 'cancelled' })
    .eq('event_id', eventId)
    .eq('status_code', 'pending');

  if (error) {
    throw new Error(`Could not cancel pending message jobs: ${error.message}`);
  }
}

async function queueMessageJobs(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  event: EventRow;
  createdByUserId: string | null;
}) {
  const { supabase, event, createdByUserId } = args;

  const { data: invites, error: invitesError } = await supabase
    .from('event_invited_councils')
    .select('id, invited_council_name, invite_email, rsvp_link_token')
    .eq('event_id', event.id)
    .returns<
      Array<{
        id: string;
        invited_council_name: string;
        invite_email: string | null;
        rsvp_link_token: string;
      }>
    >();

  if (invitesError) {
    throw new Error(`Could not load invite rows for message generation: ${invitesError.message}`);
  }

  const rows: Array<Record<string, unknown>> = [];

  for (const invite of invites ?? []) {
    if (!invite.invite_email) {
      continue;
    }

    if (event.requires_rsvp) {
      const invitation = buildInvitationMessage({ event, invite });

      rows.push({
        event_id: event.id,
        event_invited_council_id: invite.id,
        message_type_code: 'rsvp_invitation',
        status_code: 'pending',
        recipient_email: invite.invite_email,
        recipient_name: invite.invited_council_name,
        subject: invitation.subject,
        body_text: invitation.body_text,
        body_html: null,
        payload_snapshot: {
          event_title: event.title,
          starts_at: event.starts_at,
          rsvp_link_token: invite.rsvp_link_token,
        },
        scheduled_for: new Date().toISOString(),
        created_by_user_id: createdByUserId,
      });
    }

    if (event.reminder_enabled && event.reminder_scheduled_for) {
      const reminder = buildReminderMessage({ event, invite });

      rows.push({
        event_id: event.id,
        event_invited_council_id: invite.id,
        message_type_code: event.requires_rsvp ? 'rsvp_reminder' : 'event_notice',
        status_code: 'pending',
        recipient_email: invite.invite_email,
        recipient_name: invite.invited_council_name,
        subject: reminder.subject,
        body_text: reminder.body_text,
        body_html: null,
        payload_snapshot: {
          event_title: event.title,
          starts_at: event.starts_at,
          reminder_kind: event.requires_rsvp ? 'rsvp' : 'event',
          rsvp_link_token: invite.rsvp_link_token,
        },
        scheduled_for: event.reminder_scheduled_for,
        created_by_user_id: createdByUserId,
      });
    }
  }

  if (event.scope_code === 'home_council_only' && event.reminder_enabled && event.reminder_scheduled_for) {
    const hostInvite = await loadHostInviteForEvent({ supabase, eventId: event.id });

    if (hostInvite?.id) {
      const { data: submissions, error: submissionsError } = await supabase
        .from('event_person_rsvps')
        .select('primary_name, primary_email')
        .eq('event_id', event.id)
        .eq('status_code', 'active')
        .returns<Array<{ primary_name: string; primary_email: string | null }>>();

      if (submissionsError) {
        throw new Error(`Could not load volunteer reminder recipients: ${submissionsError.message}`);
      }

      for (const submission of submissions ?? []) {
        const recipientEmail = normalizeEmail(submission.primary_email);
        if (!recipientEmail) {
          continue;
        }

        const reminder = buildVolunteerReminderMessage({ event, volunteerName: submission.primary_name });

        rows.push({
          event_id: event.id,
          event_invited_council_id: hostInvite.id,
          message_type_code: 'volunteer_reminder',
          status_code: 'pending',
          recipient_email: recipientEmail,
          recipient_name: submission.primary_name,
          subject: reminder.subject,
          body_text: reminder.body_text,
          body_html: null,
          payload_snapshot: {
            event_title: event.title,
            starts_at: event.starts_at,
            volunteer_name: submission.primary_name,
            message_kind: 'volunteer_reminder',
          },
          scheduled_for: event.reminder_scheduled_for,
          created_by_user_id: createdByUserId,
        });
      }
    }
  }

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from('event_message_jobs').insert(rows);

  if (error) {
    throw new Error(`Could not queue event messages: ${error.message}`);
  }
}

async function loadOwnedEvent(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
  councilId: string;
}) {
  const { supabase, eventId, councilId } = args;

  const { data, error } = await supabase
    .from('events')
    .select(
      'id, council_id, status_code, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before'
    )
    .eq('id', eventId)
    .eq('council_id', councilId)
    .single();

  const event = data as EventRow | null;

  if (error || !event) {
    throw new Error('Could not load that event.');
  }

  return event;
}


async function revalidateEventVolunteerPaths(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
}) {
  const { supabase, eventId } = args;

  const { data: hostInviteData } = await supabase
    .from('event_invited_councils')
    .select('rsvp_link_token')
    .eq('event_id', eventId)
    .eq('is_host', true)
    .maybeSingle();

  revalidatePath('/events');
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/volunteers`);

  const token = (hostInviteData as { rsvp_link_token: string } | null)?.rsvp_link_token;

  if (token) {
    revalidatePath(`/rsvp/${token}`);
    revalidatePath(`/rsvp/${token}/event`);
  }
}

async function submitPersonRsvpByToken(args: {
  supabase: AdminClient;
  formData: FormData;
  token: string;
  invite: {
    id: string;
    event_id: string;
    invite_email: string | null;
  };
  event: EventRow;
}) {
  const { supabase, formData, token, invite, event } = args;

  const primaryName = normalizeString(formData.get('primary_name'));
  const primaryEmail = normalizeEmail(formData.get('primary_email'));
  const primaryPhone = nullableString(formData.get('primary_phone'));
  const responseNotes = nullableString(formData.get('response_notes'));

  if (!primaryName) {
    throw new Error('Your name is required.');
  }

  if (!primaryEmail) {
    throw new Error('Your email is required.');
  }

  const additionalAttendees = parsePersonAttendeeRows(formData);
  const sourceCode =
    invite.invite_email && invite.invite_email.toLowerCase() === primaryEmail
      ? 'email_link'
      : 'public_link';

  const result = await savePersonRsvpSubmission({
    supabase,
    eventId: event.id,
    hostCouncilId: event.council_id,
    primaryName,
    primaryEmail,
    primaryPhone,
    responseNotes,
    attendees: additionalAttendees,
    sourceCode,
  });

  await cancelPendingVolunteerMessageJobs({
    supabase,
    eventId: event.id,
    recipientEmail: primaryEmail,
  });

  await queueVolunteerMessageJob({
    supabase,
    event,
    createdByUserId: null,
    recipientEmail: primaryEmail,
    recipientName: primaryName,
    messageTypeCode: 'volunteer_confirmation',
  });

  await replaceVolunteerReminderJob({
    supabase,
    event,
    createdByUserId: null,
    recipientEmail: primaryEmail,
    recipientName: primaryName,
  });

  revalidatePath(`/rsvp/${token}`);
  revalidatePath(`/rsvp/${token}/event`);
  revalidatePath(`/events/${event.id}`);
  revalidatePath(`/events/${event.id}/volunteers`);

  redirect(
    buildRsvpResultUrl({
      token,
      flow: 'person',
      submissionId: result.submissionId,
    })
  );
}

export async function createEvent(formData: FormData) {
  const { supabase, appUser, council } = await getCurrentAppContext({ redirectTo: '/events' });
  const eventInput = buildEventPayload(formData);
  const invitedCouncils =
    eventInput.scope_code === 'multi_council' ? parseInvitedCouncils(formData) : [];
  const externalInvitees = parseExternalInvitees(formData);
  const submitIntent = normalizeString(formData.get('submit_intent'));
  const statusCode = submitIntent === 'draft' ? 'draft' : 'scheduled';

  const eventId = crypto.randomUUID();

  const createdEvent: EventRow = {
    id: eventId,
    council_id: council.id,
    status_code: statusCode,
    title: eventInput.title,
    description: eventInput.description,
    location_name: eventInput.location_name,
    location_address: eventInput.location_address,
    starts_at: eventInput.starts_at,
    ends_at: eventInput.ends_at,
    scope_code: eventInput.scope_code,
    event_kind_code: eventInput.event_kind_code,
    requires_rsvp: eventInput.requires_rsvp,
    needs_volunteers: eventInput.needs_volunteers,
    rsvp_deadline_at: eventInput.rsvp_deadline_at,
    reminder_enabled: eventInput.reminder_enabled,
    reminder_scheduled_for: eventInput.reminder_scheduled_for,
    reminder_days_before: eventInput.reminder_days_before,
  };

  const { error: insertError } = await supabase.from('events').insert({
    id: eventId,
    council_id: council.id,
    title: eventInput.title,
    description: eventInput.description,
    location_name: eventInput.location_name,
    location_address: eventInput.location_address,
    starts_at: eventInput.starts_at,
    ends_at: eventInput.ends_at,
    display_timezone: eventInput.display_timezone,
    status_code: statusCode,
    scope_code: eventInput.scope_code,
    event_kind_code: eventInput.event_kind_code,
    requires_rsvp: eventInput.requires_rsvp,
    needs_volunteers: eventInput.needs_volunteers,
    rsvp_deadline_at: eventInput.rsvp_deadline_at,
    reminder_enabled: eventInput.reminder_enabled,
    reminder_scheduled_for: eventInput.reminder_scheduled_for,
    reminder_days_before: eventInput.reminder_days_before,
    created_by_user_id: appUser.id,
    updated_by_user_id: appUser.id,
  });

  if (insertError) {
    throw new Error(`Could not create event: ${insertError.message}`);
  }

  await ensureHostInvite({
    supabase,
    eventId: createdEvent.id,
    council,
  });

  if (eventInput.scope_code === 'multi_council') {
    await replaceNonHostInvites({
      supabase,
      eventId: createdEvent.id,
      invitedCouncils,
    });
  }

  await replaceEventExternalInvitees({
    supabase,
    eventId: createdEvent.id,
    invitees: externalInvitees,
    userId: appUser.id,
  });

  if (createdEvent.status_code === 'scheduled') {
    await queueMessageJobs({
      supabase,
      event: createdEvent,
      createdByUserId: appUser.id,
    });
  }

  revalidatePath('/events');
  revalidatePath(`/events/${createdEvent.id}`);
  revalidatePath(`/events/${createdEvent.id}/edit`);

  redirect(`/events/${createdEvent.id}`);
}

export async function updateEvent(eventId: string, formData: FormData) {
  const { supabase, appUser, council } = await getCurrentAppContext({ eventId, redirectTo: '/events' });

  const existingEvent = await loadOwnedEvent({
    supabase,
    eventId,
    councilId: council.id,
  });

  const eventInput = buildEventPayload(formData);
  const invitedCouncils =
    eventInput.scope_code === 'multi_council' ? parseInvitedCouncils(formData) : [];
  const externalInvitees = parseExternalInvitees(formData);
  const submitIntent = normalizeString(formData.get('submit_intent'));
  const nextStatusCode =
    submitIntent === 'draft'
      ? 'draft'
      : existingEvent.status_code === 'completed' || existingEvent.status_code === 'cancelled'
        ? existingEvent.status_code
        : 'scheduled';

  const { data, error: updateError } = await supabase
    .from('events')
    .update({
      title: eventInput.title,
      description: eventInput.description,
      location_name: eventInput.location_name,
      location_address: eventInput.location_address,
      starts_at: eventInput.starts_at,
      ends_at: eventInput.ends_at,
      display_timezone: eventInput.display_timezone,
      status_code: nextStatusCode,
      scope_code: eventInput.scope_code,
      event_kind_code: eventInput.event_kind_code,
      requires_rsvp: eventInput.requires_rsvp,
      needs_volunteers: eventInput.needs_volunteers,
      rsvp_deadline_at: eventInput.rsvp_deadline_at,
      reminder_enabled: eventInput.reminder_enabled,
      reminder_scheduled_for: eventInput.reminder_scheduled_for,
      reminder_days_before: eventInput.reminder_days_before,
      updated_by_user_id: appUser.id,
    })
    .eq('id', eventId)
    .eq('council_id', council.id)
    .select(
      'id, council_id, status_code, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before'
    )
    .single();

  const updatedEvent = data as EventRow | null;

  if (updateError || !updatedEvent) {
    throw new Error(`Could not update event: ${updateError?.message ?? 'Unknown error'}`);
  }

  await ensureHostInvite({
    supabase,
    eventId: updatedEvent.id,
    council,
  });

  await replaceNonHostInvites({
    supabase,
    eventId: updatedEvent.id,
    invitedCouncils: eventInput.scope_code === 'multi_council' ? invitedCouncils : [],
  });

  await replaceEventExternalInvitees({
    supabase,
    eventId: updatedEvent.id,
    invitees: externalInvitees,
    userId: appUser.id,
  });

  await cancelPendingMessageJobs({
    supabase,
    eventId: updatedEvent.id,
  });

  if (updatedEvent.status_code === 'scheduled') {
    await queueMessageJobs({
      supabase,
      event: updatedEvent,
      createdByUserId: appUser.id,
    });
  }

  revalidatePath('/events');
  revalidatePath(`/events/${updatedEvent.id}`);
  revalidatePath(`/events/${updatedEvent.id}/edit`);

  redirect(`/events/${updatedEvent.id}`);
}


export async function duplicateEventAsDraft(eventId: string) {
  const { supabase, appUser, council } = await getCurrentAppContext({ eventId, redirectTo: '/events' });

  const event = await loadOwnedEvent({
    supabase,
    eventId,
    councilId: council.id,
  });

  const { data: invitedCouncilsData, error: invitedCouncilsError } = await supabase
    .from('event_invited_councils')
    .select('invited_council_name, invited_council_number, invite_email, invite_contact_name, sort_order')
    .eq('event_id', event.id)
    .eq('is_host', false)
    .order('sort_order', { ascending: true });

  if (invitedCouncilsError) {
    throw new Error(`Could not load invited councils for duplication: ${invitedCouncilsError.message}`);
  }

  const { data: externalInviteesData, error: externalInviteesError } = await supabase
    .from('event_external_invitees')
    .select('invitee_name, invitee_email, invitee_phone, invitee_role_label, notes, sort_order')
    .eq('event_id', event.id)
    .order('sort_order', { ascending: true });

  if (externalInviteesError) {
    throw new Error(`Could not load external invitees for duplication: ${externalInviteesError.message}`);
  }

  const duplicatedEventId = await createDraftEventFromSeed({
    supabase,
    council,
    userId: appUser.id,
    seed: {
      title: event.title,
      description: event.description,
      location_name: event.location_name,
      location_address: event.location_address,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      scope_code: event.scope_code,
      event_kind_code: event.event_kind_code,
      requires_rsvp: event.requires_rsvp,
      needs_volunteers: event.needs_volunteers,
      rsvp_deadline_at: event.rsvp_deadline_at,
      reminder_enabled: event.reminder_enabled,
      reminder_scheduled_for: event.reminder_scheduled_for,
      reminder_days_before: event.reminder_days_before,
    },
    invitedCouncils: (invitedCouncilsData ?? []).map((row) => ({
      invited_council_name: row.invited_council_name,
      invited_council_number: row.invited_council_number,
      invite_email: row.invite_email,
      invite_contact_name: row.invite_contact_name,
    })),
    externalInvitees: (externalInviteesData ?? []).map((row) => ({
      invitee_name: row.invitee_name,
      invitee_email: row.invitee_email,
      invitee_phone: row.invitee_phone,
      invitee_role_label: row.invitee_role_label,
      notes: row.notes,
      sort_order: row.sort_order,
    })),
  });

  redirect(`/events/${duplicatedEventId}/edit`);
}

export async function duplicateArchivedEventAsDraft(archiveId: string) {
  const { supabase, appUser, council } = await getCurrentAppContext({ redirectTo: '/events/archive' });

  const { data, error } = await supabase
    .from('event_archives')
    .select(
      'id, council_id, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before'
    )
    .eq('id', archiveId)
    .eq('council_id', council.id)
    .single();

  const archive = data as Omit<EventRow, 'id' | 'status_code'> & { id: string; council_id: string } | null;

  if (error || !archive) {
    throw new Error('Could not load that archived event.');
  }

  const duplicatedEventId = await createDraftEventFromSeed({
    supabase,
    council,
    userId: appUser.id,
    seed: {
      title: archive.title,
      description: archive.description,
      location_name: archive.location_name,
      location_address: archive.location_address,
      starts_at: archive.starts_at,
      ends_at: archive.ends_at,
      scope_code: archive.scope_code,
      event_kind_code: archive.event_kind_code,
      requires_rsvp: archive.requires_rsvp,
      needs_volunteers: archive.needs_volunteers,
      rsvp_deadline_at: archive.rsvp_deadline_at,
      reminder_enabled: archive.reminder_enabled,
      reminder_scheduled_for: archive.reminder_scheduled_for,
      reminder_days_before: archive.reminder_days_before,
    },
  });

  redirect(`/events/${duplicatedEventId}/edit`);
}

export async function deleteEvent(eventId: string) {
  const { supabase, appUser, council } = await getCurrentAppContext({ eventId, redirectTo: '/events' });

  const event = await loadOwnedEvent({
    supabase,
    eventId,
    councilId: council.id,
  });

  const { error: archiveError } = await supabase.from('event_archives').insert({
    original_event_id: event.id,
    council_id: event.council_id,
    title: event.title,
    description: event.description,
    location_name: event.location_name,
    location_address: event.location_address,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    status_code: event.status_code,
    scope_code: event.scope_code,
    event_kind_code: event.event_kind_code,
    requires_rsvp: event.requires_rsvp,
    rsvp_deadline_at: event.rsvp_deadline_at,
    reminder_enabled: event.reminder_enabled,
    reminder_scheduled_for: event.reminder_scheduled_for,
    reminder_days_before: event.reminder_days_before,
    deleted_at: new Date().toISOString(),
    deleted_by_user_id: appUser.id,
  });

  if (archiveError) {
    throw new Error(`Could not archive event before deletion: ${archiveError.message}`);
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('council_id', council.id);

  if (error) {
    throw new Error(`Could not delete event: ${error.message}`);
  }

  revalidatePath('/events');
  revalidatePath('/events/archive');
  redirect('/events');
}

export async function addHostManualVolunteer(
  eventId: string,
  returnTo: 'detail' | 'volunteers' = 'detail',
  formData: FormData
) {
  const { supabase, council, appUser } = await getCurrentAppContext({ eventId, redirectTo: '/events' });

  const event = await loadOwnedEvent({
    supabase,
    eventId,
    councilId: council.id,
  });

  if (event.scope_code !== 'home_council_only') {
    throw new Error('Host manual volunteer entry is only available for home council only events.');
  }

  if (event.rsvp_deadline_at && new Date(event.rsvp_deadline_at).getTime() < Date.now()) {
    throw new Error('The RSVP deadline for this event has passed.');
  }

  const selectedPersonId = nullableString(formData.get('selected_person_id'));
  let matchedPersonId: string | null = null;

  let primaryName = normalizeString(formData.get('primary_name'));
  let primaryEmail = normalizeEmail(formData.get('primary_email'));
  let primaryPhone = nullableString(formData.get('primary_phone'));
  const responseNotes = nullableString(formData.get('response_notes'));

  if (selectedPersonId) {
    const { data: personData, error: personError } = await supabase
      .from('people')
      .select(
        'id, first_name, last_name, directory_display_name_override, email, cell_phone, home_phone, other_phone'
      )
      .eq('id', selectedPersonId)
      .eq('council_id', council.id)
      .is('archived_at', null)
      .is('merged_into_person_id', null)
      .single();

    const person = personData
      ? decryptPeopleRecord(personData as {
          id: string;
          first_name: string;
          last_name: string;
          directory_display_name_override: string | null;
          email: string | null;
          cell_phone: string | null;
          home_phone: string | null;
          other_phone: string | null;
        })
      : null;

    if (personError || !person) {
      throw new Error('Could not load the selected member.');
    }

    matchedPersonId = person.id;

    if (!primaryName) {
      primaryName = person.directory_display_name_override?.trim() || `${person.first_name} ${person.last_name}`.trim();
    }

    if (!primaryEmail) {
      primaryEmail = normalizeEmail(person.email);
    }

    if (!primaryPhone) {
      primaryPhone = nullableString(person.cell_phone);
    }

    const currentEmail = normalizeEmail(person.email);
    const currentPhone = nullableString(person.cell_phone);
    const currentHomePhone = nullableString(person.home_phone);
    const currentOtherPhone = nullableString(person.other_phone);

    if (primaryEmail !== currentEmail || primaryPhone !== currentPhone) {
      assertPeopleContactRequirement({
        email: primaryEmail,
        cellPhone: primaryPhone,
        homePhone: currentHomePhone,
        otherPhone: currentOtherPhone,
        contextLabel: 'This member',
      });

      const { error: updatePersonError } = await supabase
        .from('people')
        .update(protectPeoplePayload({ email: primaryEmail, cell_phone: primaryPhone }))
        .eq('id', person.id)
        .eq('council_id', council.id);

      if (updatePersonError) {
        throw new Error(`Could not update member contact info: ${updatePersonError.message}`);
      }
    }
  }

  if (!primaryName) {
    throw new Error('Volunteer name is required.');
  }

  await savePersonRsvpSubmission({
    supabase,
    eventId: event.id,
    hostCouncilId: council.id,
    primaryName,
    primaryEmail,
    primaryPhone,
    responseNotes,
    attendees: [],
    sourceCode: 'host_manual',
    explicitMatchedPersonId: matchedPersonId,
  });

  await cancelPendingVolunteerMessageJobs({
    supabase,
    eventId: event.id,
    recipientEmail: primaryEmail,
  });

  await queueVolunteerMessageJob({
    supabase,
    event,
    createdByUserId: appUser.id,
    recipientEmail: primaryEmail,
    recipientName: primaryName,
    messageTypeCode: 'volunteer_confirmation',
  });

  await replaceVolunteerReminderJob({
    supabase,
    event,
    createdByUserId: appUser.id,
    recipientEmail: primaryEmail,
    recipientName: primaryName,
  });

  await revalidateEventVolunteerPaths({ supabase, eventId: event.id });

  redirect(returnTo === 'volunteers' ? `/events/${event.id}/volunteers` : `/events/${event.id}`);
}

export async function updateHostManualVolunteer(
  eventId: string,
  submissionId: string,
  formData: FormData
) {
  const { supabase, council } = await getCurrentAppContext({ eventId, redirectTo: '/events' });

  const event = await loadOwnedEvent({
    supabase,
    eventId,
    councilId: council.id,
  });

  if (event.scope_code !== 'home_council_only') {
    throw new Error('Manual volunteer editing is only available for home council only events.');
  }

  const { data: submissionData, error: submissionError } = await supabase
    .from('event_person_rsvps')
    .select('id, event_id, matched_person_id, source_code, status_code')
    .eq('id', submissionId)
    .eq('event_id', event.id)
    .single();

  const submission = submissionData as {
    id: string;
    event_id: string;
    matched_person_id: string | null;
    source_code: 'host_manual' | 'email_link' | 'public_link';
    status_code: 'active' | 'cancelled';
  } | null;

  if (submissionError || !submission) {
    throw new Error('Could not load that volunteer submission.');
  }

  if (submission.source_code !== 'host_manual') {
    throw new Error('Only host-added volunteers can be edited here.');
  }

  if (submission.status_code !== 'active') {
    throw new Error('Only active volunteer submissions can be edited.');
  }

  const primaryName = normalizeString(formData.get('primary_name'));
  const primaryEmail = normalizeEmail(formData.get('primary_email'));
  const primaryPhone = nullableString(formData.get('primary_phone'));
  const responseNotes = nullableString(formData.get('response_notes'));

  if (!primaryName) {
    throw new Error('Volunteer name is required.');
  }

  if (submission.matched_person_id) {
    const { data: personData, error: personError } = await supabase
      .from('people')
      .select('id, email, cell_phone, home_phone, other_phone')
      .eq('id', submission.matched_person_id)
      .eq('council_id', council.id)
      .maybeSingle();

    if (personError) {
      throw new Error(`Could not load member profile: ${personError.message}`);
    }

    const person = personData ? decryptPeopleRecord(personData) : null;

    if (person?.id) {
      const currentEmail = normalizeEmail(person.email);
      const currentPhone = nullableString(person.cell_phone);
      const currentHomePhone = nullableString(person.home_phone);
      const currentOtherPhone = nullableString(person.other_phone);

      const nextEmail = primaryEmail ?? currentEmail;
      const nextPhone = primaryPhone ?? currentPhone;

      if (nextEmail !== currentEmail || nextPhone !== currentPhone) {
        assertPeopleContactRequirement({
          email: nextEmail,
          cellPhone: nextPhone,
          homePhone: currentHomePhone,
          otherPhone: currentOtherPhone,
          contextLabel: 'This member',
        });

        const { error: updatePersonError } = await supabase
          .from('people')
          .update(protectPeoplePayload({
            email: nextEmail,
            cell_phone: nextPhone,
          }))
          .eq('id', person.id)
          .eq('council_id', council.id);

        if (updatePersonError) {
          throw new Error(`Could not update member contact info: ${updatePersonError.message}`);
        }
      }
    }
  }

  await savePersonRsvpSubmission({
    supabase,
    eventId: event.id,
    hostCouncilId: council.id,
    primaryName,
    primaryEmail,
    primaryPhone,
    responseNotes,
    attendees: [],
    sourceCode: submission.source_code,
    existingSubmissionId: submission.id,
    explicitMatchedPersonId: submission.matched_person_id,
  });

  await revalidateEventVolunteerPaths({
    supabase,
    eventId: event.id,
  });

  redirect(`/events/${event.id}/volunteers`);
}


export async function removeVolunteerSubmission(
  eventId: string,
  submissionId: string,
  returnTo: 'detail' | 'volunteers' = 'volunteers'
) {
  const { supabase, council, appUser } = await getCurrentAppContext({ eventId, redirectTo: '/events' });

  const event = await loadOwnedEvent({
    supabase,
    eventId,
    councilId: council.id,
  });

  if (event.scope_code !== 'home_council_only') {
    throw new Error('Volunteer removal is only available for home council only events.');
  }

  const { data: submissionData, error: submissionError } = await supabase
    .from('event_person_rsvps')
    .select('id, event_id, primary_name, primary_email, source_code, status_code')
    .eq('id', submissionId)
    .eq('event_id', event.id)
    .single();

  const submission = submissionData as {
    id: string;
    event_id: string;
    primary_name: string | null;
    primary_email: string | null;
    source_code: 'host_manual' | 'email_link' | 'public_link';
    status_code: 'active' | 'cancelled';
  } | null;

  if (submissionError || !submission) {
    throw new Error('Could not load that volunteer submission.');
  }

  if (submission.status_code !== 'active') {
    throw new Error('Only active volunteer submissions can be removed.');
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('event_person_rsvps')
    .update({ status_code: 'cancelled', cancelled_at: now, last_responded_at: now })
    .eq('id', submission.id)
    .eq('event_id', event.id);

  if (updateError) {
    throw new Error(`Could not remove volunteer submission: ${updateError.message}`);
  }

  await cancelPendingVolunteerMessageJobs({
    supabase,
    eventId: event.id,
    recipientEmail: submission.primary_email,
  });

  await queueVolunteerMessageJob({
    supabase,
    event,
    createdByUserId: appUser.id,
    recipientEmail: submission.primary_email,
    recipientName: submission.primary_name ?? 'Volunteer',
    messageTypeCode: 'volunteer_removed',
  });

  await revalidateEventVolunteerPaths({ supabase, eventId: event.id });

  redirect(returnTo === 'detail' ? `/events/${event.id}#volunteer-detail` : `/events/${event.id}/volunteers`);
}

export const removeHostManualVolunteer = removeVolunteerSubmission;

export async function revokePersonRsvpByToken(token: string, submissionId: string) {
  const supabase = createAdminClient();

  if (!token) {
    throw new Error('Missing RSVP token.');
  }

  if (!submissionId) {
    throw new Error('Missing RSVP submission.');
  }

  const { data: inviteData, error: inviteError } = await supabase
    .from('event_invited_councils')
    .select('id, event_id')
    .eq('rsvp_link_token', token)
    .single();

  const invite = inviteData as { id: string; event_id: string } | null;

  if (inviteError || !invite) {
    throw new Error('That RSVP link is not valid.');
  }

  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select('id, scope_code, rsvp_deadline_at')
    .eq('id', invite.event_id)
    .single();

  const event = eventData as {
    id: string;
    scope_code: 'home_council_only' | 'multi_council';
    rsvp_deadline_at: string | null;
  } | null;

  if (eventError || !event) {
    throw new Error('Could not load the event for this RSVP link.');
  }

  if (event.scope_code !== 'home_council_only') {
    throw new Error('This revoke action is only available for individual RSVP links.');
  }

  if (event.rsvp_deadline_at && new Date(event.rsvp_deadline_at).getTime() < Date.now()) {
    throw new Error('The RSVP deadline for this event has passed.');
  }

  const { data: submissionData, error: submissionError } = await supabase
    .from('event_person_rsvps')
    .select('id, event_id, status_code')
    .eq('id', submissionId)
    .eq('event_id', event.id)
    .single();

  const submission = submissionData as {
    id: string;
    event_id: string;
    status_code: 'active' | 'cancelled';
  } | null;

  if (submissionError || !submission) {
    throw new Error('Could not load your RSVP submission.');
  }

  if (submission.status_code !== 'active') {
    throw new Error('This RSVP has already been removed.');
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('event_person_rsvps')
    .update({
      status_code: 'cancelled',
      cancelled_at: now,
      last_responded_at: now,
    })
    .eq('id', submission.id)
    .eq('event_id', event.id);

  if (updateError) {
    throw new Error(`Could not remove RSVP: ${updateError.message}`);
  }

  revalidatePath(`/rsvp/${token}`);
  revalidatePath(`/rsvp/${token}/event`);
  revalidatePath(`/events/${event.id}`);
  revalidatePath(`/events/${event.id}/volunteers`);

  redirect(
    buildRsvpResultUrl({
      token,
      flow: 'person',
      revoked: true,
    })
  );
}

export async function submitCouncilRsvpByToken(formData: FormData) {
  const supabase = createAdminClient();
  const token = normalizeString(formData.get('token'));
  const rsvpFlow = normalizeString(formData.get('rsvp_flow'));

  if (!token) {
    throw new Error('Missing RSVP token.');
  }

  const { data: inviteData, error: inviteError } = await supabase
    .from('event_invited_councils')
    .select('id, event_id, invite_email')
    .eq('rsvp_link_token', token)
    .single();

  const invite = inviteData as { id: string; event_id: string; invite_email: string | null } | null;

  if (inviteError || !invite) {
    throw new Error('That RSVP link is not valid.');
  }

  const { data: eventData, error: eventError } = await supabase
    .from('events')
.select('id, council_id, title, description, location_name, location_address, starts_at, ends_at, status_code, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before')
    .eq('id', invite.event_id)
    .single();

  const event = eventData as EventRow | null;

  if (eventError || !event) {
    throw new Error('Could not load the event for this RSVP link.');
  }

  if (event.rsvp_deadline_at && new Date(event.rsvp_deadline_at).getTime() < Date.now()) {
    throw new Error('The RSVP deadline for this event has passed.');
  }

  if (event.scope_code === 'home_council_only' || rsvpFlow === 'person') {
    return submitPersonRsvpByToken({
      supabase,
      formData,
      token,
      invite,
      event,
    });
  }

  const rsvpPayload = {
    event_id: event.id,
    event_invited_council_id: invite.id,
    responding_council_name: normalizeString(formData.get('responding_council_name')),
    responding_council_number: nullableString(formData.get('responding_council_number')),
    responding_contact_name: nullableString(formData.get('responding_contact_name')),
    responding_contact_email: nullableString(formData.get('responding_contact_email')),
    responding_contact_phone: nullableString(formData.get('responding_contact_phone')),
    response_notes: nullableString(formData.get('response_notes')),
    last_responded_at: new Date().toISOString(),
  };

  if (!rsvpPayload.responding_council_name) {
    throw new Error('Council name is required.');
  }

  const { data: existingRsvpData } = await supabase
    .from('event_council_rsvps')
    .select('id')
    .eq('event_invited_council_id', invite.id)
    .maybeSingle();

  const existingRsvp = existingRsvpData as { id: string } | null;
  let rsvpId: string;

  if (existingRsvp?.id) {
    const { data: updatedRsvpData, error: updateError } = await supabase
      .from('event_council_rsvps')
      .update(rsvpPayload)
      .eq('id', existingRsvp.id)
      .select('id')
      .single();

    const updatedRsvp = updatedRsvpData as { id: string } | null;

    if (updateError || !updatedRsvp) {
      throw new Error(`Could not update RSVP response: ${updateError?.message ?? 'Unknown error'}`);
    }

    rsvpId = updatedRsvp.id;
  } else {
    const { data: createdRsvpData, error: insertError } = await supabase
      .from('event_council_rsvps')
      .insert({
        ...rsvpPayload,
        first_responded_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    const createdRsvp = createdRsvpData as { id: string } | null;

    if (insertError || !createdRsvp) {
      throw new Error(`Could not create RSVP response: ${insertError?.message ?? 'Unknown error'}`);
    }

    rsvpId = createdRsvp.id;
  }

  const volunteerRows = parseVolunteerRows(formData);

  const { error: deleteVolunteersError } = await supabase
    .from('event_rsvp_volunteers')
    .delete()
    .eq('event_council_rsvp_id', rsvpId);

  if (deleteVolunteersError) {
    throw new Error(`Could not refresh volunteer rows: ${deleteVolunteersError.message}`);
  }

  if (volunteerRows.length > 0) {
    const { error: insertVolunteersError } = await supabase
      .from('event_rsvp_volunteers')
      .insert(
        volunteerRows.map((row) => ({
          event_id: event.id,
          event_council_rsvp_id: rsvpId,
          volunteer_name: row.volunteer_name,
          volunteer_email: row.volunteer_email,
          volunteer_phone: row.volunteer_phone,
          volunteer_notes: row.volunteer_notes,
          sort_order: row.sort_order,
        }))
      );

    if (insertVolunteersError) {
      throw new Error(`Could not save volunteer rows: ${insertVolunteersError.message}`);
    }
  }

  revalidatePath(`/rsvp/${token}`);
  revalidatePath(`/rsvp/${token}/event`);
  revalidatePath(`/events/${event.id}`);
  revalidatePath(`/events/${event.id}/volunteers`);

  redirect(
    buildRsvpResultUrl({
      token,
      flow: 'council',
    })
  );
}

type EventExternalInviteeRow = {
  id: string;
};

export async function addEventExternalInvitee(eventId: string, formData: FormData) {
  const { supabase, user, council } = await getCurrentAppContext({ eventId, redirectTo: '/events' });
  const event = await loadOwnedEvent({
    supabase,
    eventId,
    councilId: council.id,
  });

  const inviteeName = normalizeString(formData.get('invitee_name'));
  if (!inviteeName) {
    throw new Error('Invitee name is required.');
  }

  const { data: existingRows } = await supabase
    .from('event_external_invitees')
    .select('id')
    .eq('event_id', event.id)
    .returns<EventExternalInviteeRow[]>();

  const sortOrder = (existingRows ?? []).length;

  const { error } = await supabase.from('event_external_invitees').insert({
    event_id: event.id,
    invitee_name: inviteeName,
    invitee_email: normalizeEmail(formData.get('invitee_email')),
    invitee_phone: nullableString(formData.get('invitee_phone')),
    invitee_role_label: nullableString(formData.get('invitee_role_label')),
    notes: nullableString(formData.get('invitee_notes')),
    sort_order: sortOrder,
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  });

  if (error) {
    throw new Error(`Could not add external invitee: ${error.message}`);
  }

  revalidatePath('/events');
  revalidatePath(`/events/${event.id}`);
  revalidatePath(`/events/${event.id}/edit`);
  redirect(`/events/${event.id}#external-invitees`);
}

export async function removeEventExternalInvitee(eventId: string, formData: FormData) {
  const { supabase, council } = await getCurrentAppContext({ eventId, redirectTo: '/events' });
  const event = await loadOwnedEvent({
    supabase,
    eventId,
    councilId: council.id,
  });
  const inviteeId = nullableString(formData.get('invitee_id'));

  if (!inviteeId) {
    throw new Error('Missing external invitee id.');
  }

  const { error } = await supabase
    .from('event_external_invitees')
    .delete()
    .eq('id', inviteeId)
    .eq('event_id', event.id);

  if (error) {
    throw new Error(`Could not remove external invitee: ${error.message}`);
  }

  revalidatePath('/events');
  revalidatePath(`/events/${event.id}`);
  revalidatePath(`/events/${event.id}/edit`);
  redirect(`/events/${event.id}#external-invitees`);
}
