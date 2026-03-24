import { NextResponse } from 'next/server';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type EventRow = {
  id: string;
  council_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location_name: string | null;
  location_address: string | null;
  scope_code: 'home_council_only' | 'multi_council';
};

type InviteRow = {
  id: string;
  invited_council_name: string;
  invited_council_number: string | null;
  invite_email: string | null;
  invite_contact_name: string | null;
  is_host: boolean;
};

type RsvpRow = {
  id: string;
  event_invited_council_id: string;
  responding_contact_name: string | null;
  responding_contact_email: string | null;
  responding_contact_phone: string | null;
  response_notes: string | null;
  last_responded_at: string;
};

type VolunteerRow = {
  id: string;
  event_council_rsvp_id: string;
  volunteer_name: string;
  volunteer_email: string | null;
  volunteer_phone: string | null;
  volunteer_notes: string | null;
  sort_order: number;
};

type EventPersonRsvpRow = {
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
  last_responded_at: string;
  claimed_at: string | null;
};

type EventPersonRsvpAttendeeRow = {
  id: string;
  event_person_rsvp_id: string;
  matched_person_id: string | null;
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  uses_primary_contact: boolean;
  is_primary: boolean;
  sort_order: number;
};

type ExportRow = {
  event_title: string;
  event_start: string;
  event_end: string;
  location_name: string;
  location_address: string;
  scope: string;
  group_name: string;
  group_number: string;
  is_host_group: string;
  submission_type: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  submission_notes: string;
  volunteer_name: string;
  volunteer_email: string;
  volunteer_phone: string;
  uses_primary_contact: string;
  is_primary: string;
  claimed_profile: string;
  last_responded_at: string;
};

function csvEscape(value: string | null | undefined) {
  const text = value ?? '';
  return `"${text.replace(/"/g, '""')}"`;
}

function fileSafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildBaseRow(event: EventRow): Omit<
  ExportRow,
  | 'group_name'
  | 'group_number'
  | 'is_host_group'
  | 'submission_type'
  | 'primary_contact_name'
  | 'primary_contact_email'
  | 'primary_contact_phone'
  | 'submission_notes'
  | 'volunteer_name'
  | 'volunteer_email'
  | 'volunteer_phone'
  | 'uses_primary_contact'
  | 'is_primary'
  | 'claimed_profile'
  | 'last_responded_at'
> {
  return {
    event_title: event.title,
    event_start: event.starts_at,
    event_end: event.ends_at,
    location_name: event.location_name ?? '',
    location_address: event.location_address ?? '',
    scope: event.scope_code,
  };
}

function exportHeader(): Array<keyof ExportRow> {
  return [
    'event_title',
    'event_start',
    'event_end',
    'location_name',
    'location_address',
    'scope',
    'group_name',
    'group_number',
    'is_host_group',
    'submission_type',
    'primary_contact_name',
    'primary_contact_email',
    'primary_contact_phone',
    'submission_notes',
    'volunteer_name',
    'volunteer_email',
    'volunteer_phone',
    'uses_primary_contact',
    'is_primary',
    'claimed_profile',
    'last_responded_at',
  ];
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { admin, council } = await getCurrentActingCouncilContext({
    redirectTo: '/me',
  });

  const { data: eventData, error: eventError } = await admin
    .from('events')
    .select(
      'id, council_id, title, starts_at, ends_at, location_name, location_address, scope_code'
    )
    .eq('id', id)
    .eq('council_id', council.id)
    .single();

  const event = eventData as EventRow | null;

  if (eventError || !event) {
    return new NextResponse('Event not found.', { status: 404 });
  }

  const baseRow = buildBaseRow(event);
  const rows: ExportRow[] = [];

  if (event.scope_code === 'multi_council') {
    const [
      { data: invitesData, error: invitesError },
      { data: rsvpsData, error: rsvpsError },
      { data: volunteersData, error: volunteersError },
    ] = await Promise.all([
      admin
        .from('event_invited_councils')
        .select(
          'id, invited_council_name, invited_council_number, invite_email, invite_contact_name, is_host'
        )
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true })
        .returns<InviteRow[]>(),
      admin
        .from('event_council_rsvps')
        .select(
          'id, event_invited_council_id, responding_contact_name, responding_contact_email, responding_contact_phone, response_notes, last_responded_at'
        )
        .eq('event_id', event.id)
        .returns<RsvpRow[]>(),
      admin
        .from('event_rsvp_volunteers')
        .select(
          'id, event_council_rsvp_id, volunteer_name, volunteer_email, volunteer_phone, volunteer_notes, sort_order'
        )
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true })
        .returns<VolunteerRow[]>(),
    ]);

    if (invitesError || rsvpsError || volunteersError) {
      return new NextResponse('Could not build export.', { status: 500 });
    }

    const invites = invitesData ?? [];
    const rsvps = rsvpsData ?? [];
    const volunteers = volunteersData ?? [];

    const inviteById = new Map(invites.map((row) => [row.id, row]));
    const volunteersByRsvpId = new Map<string, VolunteerRow[]>();

    for (const volunteer of volunteers) {
      const existing = volunteersByRsvpId.get(volunteer.event_council_rsvp_id) ?? [];
      existing.push(volunteer);
      volunteersByRsvpId.set(volunteer.event_council_rsvp_id, existing);
    }

    for (const rsvp of rsvps) {
      const invite = inviteById.get(rsvp.event_invited_council_id);
      const volunteerRows = volunteersByRsvpId.get(rsvp.id) ?? [];

      if (volunteerRows.length === 0) {
        rows.push({
          ...baseRow,
          group_name: invite?.invited_council_name ?? '',
          group_number: invite?.invited_council_number ?? '',
          is_host_group: invite?.is_host ? 'true' : 'false',
          submission_type: 'group',
          primary_contact_name: rsvp.responding_contact_name ?? '',
          primary_contact_email: rsvp.responding_contact_email ?? '',
          primary_contact_phone: rsvp.responding_contact_phone ?? '',
          submission_notes: rsvp.response_notes ?? '',
          volunteer_name: '',
          volunteer_email: '',
          volunteer_phone: '',
          uses_primary_contact: '',
          is_primary: '',
          claimed_profile: '',
          last_responded_at: rsvp.last_responded_at ?? '',
        });
        continue;
      }

      for (const volunteer of volunteerRows) {
        rows.push({
          ...baseRow,
          group_name: invite?.invited_council_name ?? '',
          group_number: invite?.invited_council_number ?? '',
          is_host_group: invite?.is_host ? 'true' : 'false',
          submission_type: 'group',
          primary_contact_name: rsvp.responding_contact_name ?? '',
          primary_contact_email: rsvp.responding_contact_email ?? '',
          primary_contact_phone: rsvp.responding_contact_phone ?? '',
          submission_notes: rsvp.response_notes ?? '',
          volunteer_name: volunteer.volunteer_name ?? '',
          volunteer_email: volunteer.volunteer_email ?? '',
          volunteer_phone: volunteer.volunteer_phone ?? '',
          uses_primary_contact: '',
          is_primary: '',
          claimed_profile: '',
          last_responded_at: rsvp.last_responded_at ?? '',
        });
      }
    }
  } else {
    const [
      { data: hostInviteData, error: hostInviteError },
      { data: personRsvpsData, error: personRsvpsError },
    ] = await Promise.all([
      admin
        .from('event_invited_councils')
        .select('id, invited_council_name, invited_council_number, is_host')
        .eq('event_id', event.id)
        .eq('is_host', true)
        .maybeSingle(),
      admin
        .from('event_person_rsvps')
        .select(
          'id, event_id, matched_person_id, claimed_by_user_id, primary_name, primary_email, primary_phone, response_notes, source_code, status_code, last_responded_at, claimed_at'
        )
        .eq('event_id', event.id)
        .eq('status_code', 'active')
        .order('last_responded_at', { ascending: false })
        .returns<EventPersonRsvpRow[]>(),
    ]);

    if (hostInviteError || personRsvpsError) {
      return new NextResponse('Could not build export.', { status: 500 });
    }

    const hostInvite = hostInviteData as
      | { id: string; invited_council_name: string; invited_council_number: string | null; is_host: boolean }
      | null;

    const personRsvps = personRsvpsData ?? [];
    const personRsvpIds = personRsvps.map((row) => row.id);

    let attendees: EventPersonRsvpAttendeeRow[] = [];

    if (personRsvpIds.length > 0) {
      const { data: attendeeData, error: attendeesError } = await admin
        .from('event_person_rsvp_attendees')
        .select(
          'id, event_person_rsvp_id, matched_person_id, attendee_name, attendee_email, attendee_phone, uses_primary_contact, is_primary, sort_order'
        )
        .in('event_person_rsvp_id', personRsvpIds)
        .order('sort_order', { ascending: true })
        .returns<EventPersonRsvpAttendeeRow[]>();

      if (attendeesError) {
        return new NextResponse('Could not build export.', { status: 500 });
      }

      attendees = attendeeData ?? [];
    }

    const attendeesByRsvpId = new Map<string, EventPersonRsvpAttendeeRow[]>();

    for (const attendee of attendees) {
      const existing = attendeesByRsvpId.get(attendee.event_person_rsvp_id) ?? [];
      existing.push(attendee);
      attendeesByRsvpId.set(attendee.event_person_rsvp_id, existing);
    }

    for (const submission of personRsvps) {
      const attendeeRows = attendeesByRsvpId.get(submission.id) ?? [];

      if (attendeeRows.length === 0) {
        rows.push({
          ...baseRow,
          group_name: hostInvite?.invited_council_name ?? '',
          group_number: hostInvite?.invited_council_number ?? '',
          is_host_group: 'true',
          submission_type: submission.source_code,
          primary_contact_name: submission.primary_name ?? '',
          primary_contact_email: submission.primary_email ?? '',
          primary_contact_phone: submission.primary_phone ?? '',
          submission_notes: submission.response_notes ?? '',
          volunteer_name: submission.primary_name ?? '',
          volunteer_email: submission.primary_email ?? '',
          volunteer_phone: submission.primary_phone ?? '',
          uses_primary_contact: 'true',
          is_primary: 'true',
          claimed_profile: submission.claimed_at ? 'true' : 'false',
          last_responded_at: submission.last_responded_at ?? '',
        });
        continue;
      }

      for (const attendee of attendeeRows) {
        rows.push({
          ...baseRow,
          group_name: hostInvite?.invited_council_name ?? '',
          group_number: hostInvite?.invited_council_number ?? '',
          is_host_group: 'true',
          submission_type: submission.source_code,
          primary_contact_name: submission.primary_name ?? '',
          primary_contact_email: submission.primary_email ?? '',
          primary_contact_phone: submission.primary_phone ?? '',
          submission_notes: submission.response_notes ?? '',
          volunteer_name: attendee.attendee_name ?? '',
          volunteer_email: attendee.uses_primary_contact
            ? submission.primary_email ?? attendee.attendee_email ?? ''
            : attendee.attendee_email ?? '',
          volunteer_phone: attendee.uses_primary_contact
            ? submission.primary_phone ?? attendee.attendee_phone ?? ''
            : attendee.attendee_phone ?? '',
          uses_primary_contact: attendee.uses_primary_contact ? 'true' : 'false',
          is_primary: attendee.is_primary ? 'true' : 'false',
          claimed_profile: submission.claimed_at ? 'true' : 'false',
          last_responded_at: submission.last_responded_at ?? '',
        });
      }
    }
  }

  const header = exportHeader();
  const csvLines = [
    header.map(csvEscape).join(','),
    ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(',')),
  ];

  const filename = `${fileSafe(event.title || 'event')}-volunteers.csv`;

  return new NextResponse(`\uFEFF${csvLines.join('\n')}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}