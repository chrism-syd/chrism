import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import AppHeader from '@/app/app-header';
import {
  addEventExternalInvitee,
  addHostManualVolunteer,
  duplicateEventAsDraft,
  removeEventExternalInvitee,
  removeVolunteerSubmission,
} from '../actions';
import HostManualVolunteerForm from '../host-manual-volunteer-form';
import RemoveVolunteerButton from '../remove-volunteer-button';
import { decryptPeopleRecords } from '@/lib/security/pii';

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

type OrganizationRow = {
  id: string;
  display_name: string | null;
  preferred_name: string | null;
};

type EventRow = {
  id: string;
  council_id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  location_address: string | null;
  starts_at: string;
  ends_at: string;
  status_code: string;
  scope_code: 'home_council_only' | 'multi_council';
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting';
  requires_rsvp: boolean;
  rsvp_deadline_at: string | null;
  reminder_enabled: boolean;
  reminder_scheduled_for: string | null;
};

type EventSummaryRow = {
  event_id: string;
  invited_council_count: number;
  responded_council_count: number;
  total_volunteer_count: number;
};

type InvitedCouncilRow = {
  id: string;
  event_id: string;
  is_host: boolean;
  invited_council_name: string;
  invited_council_number: string | null;
  invite_email: string | null;
  invite_contact_name: string | null;
  rsvp_link_token: string;
  sort_order: number;
};

type RollupRow = {
  event_id: string;
  event_invited_council_id: string;
  invited_council_name: string;
  invited_council_number: string | null;
  invite_email: string | null;
  is_host: boolean;
  has_responded: boolean;
  volunteer_count: number;
  last_responded_at: string | null;
  event_council_rsvp_id: string | null;
};

type RsvpRow = {
  id: string;
  event_id: string;
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

type EventPersonSummaryRow = {
  event_id: string;
  active_submission_count: number;
  total_volunteer_count: number;
  last_responded_at: string | null;
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
  first_responded_at: string;
  last_responded_at: string;
  claimed_at: string | null;
  cancelled_at: string | null;
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

type MessageJobRow = {
  id: string;
  message_type_code: string;
  status_code: string;
  recipient_email: string;
  scheduled_for: string;
  sent_at: string | null;
  failed_at: string | null;
  created_at: string;
};

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  directory_display_name_override: string | null;
  email: string | null;
  cell_phone: string | null;
};

type HostVolunteerMember = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
};

type ExternalInviteeRow = {
  id: string;
  event_id: string;
  invitee_name: string;
  invitee_email: string | null;
  invitee_phone: string | null;
  invitee_role_label: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

function formatDateTimeRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (sameDay) {
    return `${dateFormatter.format(start)} • ${timeFormatter.format(start)} to ${timeFormatter.format(end)}`;
  }

  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} to ${timeFormatter.format(
    end
  )} ${timeFormatter.format(end)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function getScopeLabel(scopeCode: string) {
  return scopeCode === 'multi_council' ? 'Multi-council' : 'Home council only';
}

function getMessageTypeLabel(code: string) {
  if (code === 'rsvp_invitation') return 'RSVP invitation';
  if (code === 'rsvp_reminder') return 'RSVP reminder';
  if (code === 'event_update') return 'Event update';
  return 'Event notice';
}

function getMessageStatusLabel(code: string) {
  if (code === 'sent') return 'Sent';
  if (code === 'failed') return 'Failed';
  if (code === 'cancelled') return 'Cancelled';
  return 'Pending';
}

function groupDisplayName(name: string, number?: string | null) {
  return number ? `${name} (${number})` : name;
}

function personDisplayName(person: PersonRow) {
  if (person.directory_display_name_override?.trim()) {
    return person.directory_display_name_override.trim();
  }

  return `${person.first_name} ${person.last_name}`.trim();
}


function getEventStatusLabel(statusCode: string) {
  if (statusCode === 'draft') return 'Draft';
  if (statusCode === 'completed') return 'Completed';
  if (statusCode === 'cancelled') return 'Cancelled';
  return 'Scheduled';
}

function getEventStatusBadgeClass(statusCode: string) {
  return statusCode === 'draft' ? 'qv-badge qv-badge-draft' : 'qv-badge';
}

function mutedTextStyle(): CSSProperties {
  return {
    marginTop: 4,
    fontSize: 14,
    color: 'var(--text-secondary)',
    wordBreak: 'break-word',
  };
}

function volunteerListStyle(): CSSProperties {
  return {
    display: 'grid',
    gap: 10,
    marginTop: 12,
  };
}

function councilCardStyle(): CSSProperties {
  return {
    border: '1px solid var(--divider)',
    borderRadius: 16,
    padding: 16,
    background: 'var(--bg-sunken)',
  };
}

function inlineMetaRowStyle(): CSSProperties {
  return {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 10,
  };
}

function rsvpLinkRowStyle(): CSSProperties {
  return {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 10,
  };
}

function tokenPathStyle(): CSSProperties {
  return {
    fontSize: 13,
    color: 'var(--text-secondary)',
    wordBreak: 'break-all',
  };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const { admin: supabase, council } = await getCurrentActingCouncilContext({ redirectTo: '/events' });

  let organization: OrganizationRow | null = null;

  if (council.organization_id) {
    const { data } = await supabase
      .from('organizations')
      .select('id, display_name, preferred_name')
      .eq('id', council.organization_id)
      .single();

    organization = (data as OrganizationRow | null) ?? null;
  }

  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select(
      'id, council_id, title, description, location_name, location_address, starts_at, ends_at, status_code, scope_code, event_kind_code, requires_rsvp, rsvp_deadline_at, reminder_enabled, reminder_scheduled_for'
    )
    .eq('id', id)
    .eq('council_id', council.id)
    .single();

  const event = eventData as EventRow | null;

  if (eventError || !event) {
    notFound();
  }

  const isSingleCouncil = event.scope_code === 'home_council_only';
  const isMeeting = event.event_kind_code !== 'standard';
  const isDraft = event.status_code === 'draft';
  const shouldShowVolunteerPanels = !isMeeting && event.requires_rsvp && !isDraft;
  const shouldShowResponsesPanel = !isSingleCouncil;
  const shouldShowAddVolunteerPanel = shouldShowVolunteerPanels && isSingleCouncil;
  const shouldShowExternalInviteesPanel = isMeeting;
  const shouldShowVolunteerResponsesPanel = shouldShowVolunteerPanels;
  const hasPrimaryContentColumn =
    shouldShowResponsesPanel ||
    shouldShowAddVolunteerPanel ||
    shouldShowExternalInviteesPanel ||
    shouldShowVolunteerResponsesPanel;
  const addHostManualVolunteerAction = addHostManualVolunteer.bind(null, event.id, 'detail');
  const duplicateEventAsDraftAction = duplicateEventAsDraft.bind(null, event.id);
  const addExternalInviteeAction = addEventExternalInvitee.bind(null, event.id);
  const removeExternalInviteeAction = removeEventExternalInvitee.bind(null, event.id);

  let hostInviteToken: string | null = null;
  let hostVolunteerMembers: HostVolunteerMember[] = [];

  let summaryRows: EventSummaryRow[] = [];
  let invitedCouncils: InvitedCouncilRow[] = [];
  let rollups: RollupRow[] = [];
  let rsvps: RsvpRow[] = [];
  let volunteers: VolunteerRow[] = [];
  let personSummaryRows: EventPersonSummaryRow[] = [];
  let personRsvps: EventPersonRsvpRow[] = [];
  let personAttendees: EventPersonRsvpAttendeeRow[] = [];
  let messageJobs: MessageJobRow[] = [];
  let externalInvitees: ExternalInviteeRow[] = [];

  if (isSingleCouncil) {
    const [
      { data: hostInviteData, error: hostInviteError },
      { data: personSummaryData, error: personSummaryError },
      { data: personRsvpData, error: personRsvpError },
      { data: messageJobsData, error: messageJobsError },
      { data: peopleData, error: peopleError },
      { data: externalInviteeData, error: externalInviteeError },
    ] = await Promise.all([
      supabase
        .from('event_invited_councils')
        .select('rsvp_link_token')
        .eq('event_id', event.id)
        .eq('is_host', true)
        .maybeSingle(),
      supabase
        .from('event_person_rsvp_summary')
        .select('event_id, active_submission_count, total_volunteer_count, last_responded_at')
        .eq('event_id', event.id)
        .returns<EventPersonSummaryRow[]>(),
      supabase
        .from('event_person_rsvps')
        .select(
          'id, event_id, matched_person_id, claimed_by_user_id, primary_name, primary_email, primary_phone, response_notes, source_code, status_code, first_responded_at, last_responded_at, claimed_at, cancelled_at'
        )
        .eq('event_id', event.id)
        .eq('status_code', 'active')
        .order('last_responded_at', { ascending: false })
        .returns<EventPersonRsvpRow[]>(),
      supabase
        .from('event_message_jobs')
        .select(
          'id, message_type_code, status_code, recipient_email, scheduled_for, sent_at, failed_at, created_at'
        )
        .eq('event_id', event.id)
        .neq('status_code', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(20)
        .returns<MessageJobRow[]>(),
      supabase
        .from('people')
        .select(
          'id, first_name, last_name, directory_display_name_override, email, cell_phone'
        )
        .eq('council_id', council.id)
        .is('archived_at', null)
        .is('merged_into_person_id', null)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .returns<PersonRow[]>(),
      supabase
        .from('event_external_invitees')
        .select(
          'id, event_id, invitee_name, invitee_email, invitee_phone, invitee_role_label, notes, sort_order, created_at'
        )
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .returns<ExternalInviteeRow[]>(),
    ]);

    if (
      hostInviteError ||
      personSummaryError ||
      personRsvpError ||
      messageJobsError ||
      peopleError ||
      externalInviteeError
    ) {
      return (
        <main className="qv-page">
          <div className="qv-shell">
            <AppHeader />
            <section className="qv-card qv-error">Could not load all event detail data.</section>
          </div>
        </main>
      );
    }

    personSummaryRows = personSummaryData ?? [];
    personRsvps = personRsvpData ?? [];
    messageJobs = messageJobsData ?? [];
    hostInviteToken =
      (hostInviteData as { rsvp_link_token: string } | null)?.rsvp_link_token ?? null;
    externalInvitees = externalInviteeData ?? [];

    hostVolunteerMembers = decryptPeopleRecords(peopleData ?? []).map((person) => ({
      id: person.id,
      display_name: personDisplayName(person),
      email: person.email?.trim() ?? null,
      phone: person.cell_phone ?? null,
    }));

    const personRsvpIds = personRsvps.map((row) => row.id);

    if (personRsvpIds.length > 0) {
      const { data: personAttendeeData, error: personAttendeeError } = await supabase
        .from('event_person_rsvp_attendees')
        .select(
          'id, event_person_rsvp_id, matched_person_id, attendee_name, attendee_email, attendee_phone, uses_primary_contact, is_primary, sort_order'
        )
        .in('event_person_rsvp_id', personRsvpIds)
        .order('sort_order', { ascending: true })
        .returns<EventPersonRsvpAttendeeRow[]>();

      if (personAttendeeError) {
        return (
          <main className="qv-page">
            <div className="qv-shell">
              <AppHeader />
              <section className="qv-card qv-error">Could not load volunteer detail data.</section>
            </div>
          </main>
        );
      }

      personAttendees = personAttendeeData ?? [];
    }
  } else {
    const [
      { data: summaryRowsData, error: summaryError },
      { data: invitedCouncilsData, error: invitedError },
      { data: rollupsData, error: rollupsError },
      { data: rsvpsData, error: rsvpsError },
      { data: volunteersData, error: volunteersError },
      { data: messageJobsData, error: messageJobsError },
      { data: externalInviteeData, error: externalInviteeError },
    ] = await Promise.all([
      supabase
        .from('event_host_summary')
        .select('event_id, invited_council_count, responded_council_count, total_volunteer_count')
        .eq('event_id', event.id)
        .returns<EventSummaryRow[]>(),
      supabase
        .from('event_invited_councils')
        .select(
          'id, event_id, is_host, invited_council_name, invited_council_number, invite_email, invite_contact_name, rsvp_link_token, sort_order'
        )
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true })
        .returns<InvitedCouncilRow[]>(),
      supabase
        .from('event_council_rsvp_rollups')
        .select(
          'event_id, event_invited_council_id, invited_council_name, invited_council_number, invite_email, is_host, has_responded, volunteer_count, last_responded_at, event_council_rsvp_id'
        )
        .eq('event_id', event.id)
        .returns<RollupRow[]>(),
      supabase
        .from('event_council_rsvps')
        .select(
          'id, event_id, event_invited_council_id, responding_contact_name, responding_contact_email, responding_contact_phone, response_notes, last_responded_at'
        )
        .eq('event_id', event.id)
        .returns<RsvpRow[]>(),
      supabase
        .from('event_rsvp_volunteers')
        .select(
          'id, event_council_rsvp_id, volunteer_name, volunteer_email, volunteer_phone, volunteer_notes, sort_order'
        )
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true })
        .returns<VolunteerRow[]>(),
      supabase
        .from('event_message_jobs')
        .select(
          'id, message_type_code, status_code, recipient_email, scheduled_for, sent_at, failed_at, created_at'
        )
        .eq('event_id', event.id)
        .neq('status_code', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(20)
        .returns<MessageJobRow[]>(),
      supabase
        .from('event_external_invitees')
        .select(
          'id, event_id, invitee_name, invitee_email, invitee_phone, invitee_role_label, notes, sort_order, created_at'
        )
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .returns<ExternalInviteeRow[]>(),
    ]);

    if (
      summaryError ||
      invitedError ||
      rollupsError ||
      rsvpsError ||
      volunteersError ||
      messageJobsError ||
      externalInviteeError
    ) {
      return (
        <main className="qv-page">
          <div className="qv-shell">
            <AppHeader />
            <section className="qv-card qv-error">Could not load all event detail data.</section>
          </div>
        </main>
      );
    }

    summaryRows = summaryRowsData ?? [];
    invitedCouncils = invitedCouncilsData ?? [];
    rollups = rollupsData ?? [];
    rsvps = rsvpsData ?? [];
    volunteers = volunteersData ?? [];
    messageJobs = messageJobsData ?? [];
    externalInvitees = externalInviteeData ?? [];
  }

  const summary = summaryRows[0] ?? {
    event_id: event.id,
    invited_council_count: invitedCouncils.length,
    responded_council_count: 0,
    total_volunteer_count: 0,
  };

  const singleSummary = personSummaryRows[0] ?? {
    event_id: event.id,
    active_submission_count: personRsvps.length,
    total_volunteer_count: personAttendees.length,
    last_responded_at: personRsvps[0]?.last_responded_at ?? null,
  };

  const rsvpByInviteId = new Map(rsvps.map((row) => [row.event_invited_council_id, row]));
  const volunteersByRsvpId = new Map<string, VolunteerRow[]>();

  for (const volunteer of volunteers) {
    const existing = volunteersByRsvpId.get(volunteer.event_council_rsvp_id) ?? [];
    existing.push(volunteer);
    volunteersByRsvpId.set(volunteer.event_council_rsvp_id, existing);
  }

  const rollupByInviteId = new Map(rollups.map((row) => [row.event_invited_council_id, row]));

  const personAttendeesByRsvpId = new Map<string, EventPersonRsvpAttendeeRow[]>();
  for (const attendee of personAttendees) {
    const existing = personAttendeesByRsvpId.get(attendee.event_person_rsvp_id) ?? [];
    existing.push(attendee);
    personAttendeesByRsvpId.set(attendee.event_person_rsvp_id, existing);
  }





  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div className="qv-detail-hero-main">
              <div>
                <p className="qv-eyebrow">
                  {organization?.preferred_name ?? organization?.display_name ? `${organization?.preferred_name ?? organization?.display_name} • ` : ''}
                  {council.name ?? 'Council'}
                  {council.council_number ? ` (${council.council_number})` : ''}
                </p>

                <h1 className="qv-title">{event.title}</h1>
                <p className="qv-subtitle">{formatDateTimeRange(event.starts_at, event.ends_at)}</p>

                {!isSingleCouncil ? (
                  <div style={mutedTextStyle()}>
                    Host: {groupDisplayName(council.name ?? 'Host', council.council_number)}
                  </div>
                ) : null}

                <div className="qv-detail-badges">
                  <span className={getEventStatusBadgeClass(event.status_code)}>{getEventStatusLabel(event.status_code)}</span>
                  <span className="qv-badge">{getScopeLabel(event.scope_code)}</span>
                  <span className="qv-badge">{event.requires_rsvp ? 'RSVP required' : 'No RSVP'}</span>
                  {event.event_kind_code !== 'standard' ? (
                    <span className="qv-badge">
                      {event.event_kind_code === 'executive_meeting'
                        ? 'Executive meeting'
                        : 'General meeting'}
                    </span>
                  ) : null}
                </div>

                {isDraft ? (
                  <div style={mutedTextStyle()}>
                    This event is still a draft, so public RSVP links stay hidden until you publish it.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="qv-detail-actions">
              <Link href="/events" className="qv-link-button qv-button-secondary">
                Back to events
              </Link>

              {isSingleCouncil && hostInviteToken && !isDraft ? (
                <>
                  <Link
                    href={`/rsvp/${hostInviteToken}`}
                    className="qv-link-button qv-button-secondary"
                  >
                    Open RSVP page
                  </Link>

                  <Link
                    href={`/rsvp/${hostInviteToken}/event`}
                    className="qv-link-button qv-button-secondary"
                  >
                    Open public event view
                  </Link>
                </>
              ) : null}

              {(event.status_code === 'completed' || event.status_code === 'cancelled') ? (
                <form action={duplicateEventAsDraftAction}>
                  <button type="submit" className="qv-button-secondary">
                    Duplicate as draft
                  </button>
                </form>
              ) : null}

              <Link href={`/events/${event.id}/edit`} className="qv-link-button qv-button-primary">
                Edit event
              </Link>
            </div>
          </div>

          {!isDraft ? (
            isSingleCouncil ? (
              <div className="qv-stats">
                <div className="qv-stat-card">
                  <div className="qv-stat-number">{singleSummary.total_volunteer_count}</div>
                  <div className="qv-stat-label">Total volunteers</div>
                </div>

                <div className="qv-stat-card">
                  <div className="qv-stat-number">{singleSummary.active_submission_count}</div>
                  <div className="qv-stat-label">Responses</div>
                </div>

                <div className="qv-stat-card">
                  <div className="qv-stat-number">{event.reminder_enabled ? 'On' : 'Off'}</div>
                  <div className="qv-stat-label">Reminder</div>
                </div>
              </div>
            ) : (
              <div className="qv-stats">
                <div className="qv-stat-card">
                  <div className="qv-stat-number">{summary.invited_council_count}</div>
                  <div className="qv-stat-label">Invited</div>
                </div>

                <div className="qv-stat-card">
                  <div className="qv-stat-number">{summary.responded_council_count}</div>
                  <div className="qv-stat-label">Responded</div>
                </div>

                <div className="qv-stat-card">
                  <div className="qv-stat-number">{summary.total_volunteer_count}</div>
                  <div className="qv-stat-label">Total volunteers</div>
                </div>
              </div>
            )
          ) : null}

          {event.description?.trim() ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {event.description.trim()}
            </div>
          ) : null}
        </section>

        <div className={`qv-detail-grid${hasPrimaryContentColumn ? '' : ' qv-detail-grid-single'}`}>
          {hasPrimaryContentColumn ? (
            <div className="qv-detail-stack">
              {shouldShowResponsesPanel ? (
              <section className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Responses</h2>
                    <p className="qv-section-subtitle">
                      Host view of invited groups, response state, and current volunteer counts.
                    </p>
                  </div>
                </div>

                {invitedCouncils.length === 0 ? (
                  <div className="qv-empty">
                    <h3 className="qv-empty-title">No invited groups found</h3>
                    <p className="qv-empty-text">This event does not have any invite rows yet.</p>
                  </div>
                ) : (
                  <div className="qv-member-list">
                    {invitedCouncils.map((invite) => {
                      const rollup = rollupByInviteId.get(invite.id);
                      const rsvp = rsvpByInviteId.get(invite.id);

                      return (
                        <article key={invite.id} className="qv-member-row">
                          <div className="qv-member-main">
                            <div className="qv-member-text">
                              <div className="qv-member-name">
                                {groupDisplayName(
                                  invite.invited_council_name,
                                  invite.invited_council_number
                                )}
                              </div>

                              {invite.invite_email ? (
                                <div className="qv-member-meta">{invite.invite_email}</div>
                              ) : null}

                              <div style={inlineMetaRowStyle()}>
                                <span className="qv-badge">
                                  {invite.is_host ? 'Host' : 'Invited'}
                                </span>
                                <span
                                  className={`qv-badge ${rollup?.has_responded ? 'qv-badge-soft' : ''}`}
                                >
                                  {rollup?.has_responded ? 'Responded' : 'Not responded'}
                                </span>
                                <span className="qv-badge">
                                  Volunteers: {rollup?.volunteer_count ?? 0}
                                </span>
                              </div>

                              {rsvp?.last_responded_at ? (
                                <div className="qv-member-meta">
                                  Updated {formatDateTime(rsvp.last_responded_at)}
                                </div>
                              ) : null}

                              {isDraft ? (
                                <div style={mutedTextStyle()}>
                                  Public RSVP links stay hidden while this event is still a draft.
                                </div>
                              ) : (
                                <div style={rsvpLinkRowStyle()}>
                                  <Link
                                    href={`/rsvp/${invite.rsvp_link_token}`}
                                    className="qv-link-button qv-button-secondary"
                                  >
                                    Open RSVP page
                                  </Link>

                                  <Link
                                    href={`/rsvp/${invite.rsvp_link_token}/event`}
                                    className="qv-link-button qv-button-secondary"
                                  >
                                    Open public event view
                                  </Link>

                                  <span
                                    style={tokenPathStyle()}
                                  >{`/rsvp/${invite.rsvp_link_token}`}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : shouldShowAddVolunteerPanel ? (
              <section id="add-volunteer" className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Add volunteer</h2>
                    <p className="qv-section-subtitle">
                      Choose a home council member to auto-fill their contact info. You can still
                      adjust the details before saving.
                    </p>
                  </div>
                </div>

                <HostManualVolunteerForm
                  action={addHostManualVolunteerAction}
                  members={hostVolunteerMembers}
                />
              </section>
            ) : isMeeting ? (
              <section className="qv-card">
                <div className="qv-empty">
                  <h3 className="qv-empty-title">Meeting details</h3>
                  <p className="qv-empty-text">
                    Volunteer collection is turned off for meeting events.
                  </p>
                </div>
              </section>
            ) : null}

            {shouldShowExternalInviteesPanel ? (
              <section id="external-invitees" className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">External invitees</h2>
                    <p className="qv-section-subtitle">
                      Add guest speakers, presenters, or one-off attendees who are not council members.
                    </p>
                  </div>
                </div>

                <form action={addExternalInviteeAction} className="qv-form-stack">
                  <div className="qv-form-grid qv-form-grid-2">
                    <label className="qv-field">
                      <span className="qv-field-label">Name</span>
                      <input
                        name="invitee_name"
                        className="qv-input"
                        placeholder="Guest speaker"
                        required
                      />
                    </label>

                    <label className="qv-field">
                      <span className="qv-field-label">Role / context</span>
                      <input
                        name="invitee_role_label"
                        className="qv-input"
                        placeholder="Presenter, guest speaker, visitor"
                      />
                    </label>

                    <label className="qv-field">
                      <span className="qv-field-label">Email</span>
                      <input
                        name="invitee_email"
                        type="email"
                        className="qv-input"
                        placeholder="name@example.com"
                      />
                    </label>

                    <label className="qv-field">
                      <span className="qv-field-label">Phone</span>
                      <input name="invitee_phone" className="qv-input" placeholder="Optional" />
                    </label>
                  </div>

                  <label className="qv-field">
                    <span className="qv-field-label">Notes</span>
                    <textarea
                      name="invitee_notes"
                      className="qv-textarea"
                      rows={3}
                      placeholder="Optional notes about this guest"
                    />
                  </label>

                  <div className="qv-form-actions">
                    <button type="submit" className="qv-link-button qv-button-primary">
                      Add external invitee
                    </button>
                  </div>
                </form>

                {externalInvitees.length === 0 ? (
                  <div className="qv-empty" style={{ marginTop: 20 }}>
                    <h3 className="qv-empty-title">No external invitees yet</h3>
                    <p className="qv-empty-text">
                      Add guests here when a meeting includes non-members.
                    </p>
                  </div>
                ) : (
                  <div className="qv-detail-list" style={{ marginTop: 20 }}>
                    {externalInvitees.map((invitee) => (
                      <div key={invitee.id} className="qv-detail-item">
                        <div className="qv-detail-label">
                          {invitee.invitee_role_label || 'External invitee'}
                        </div>
                        <div className="qv-detail-value">{invitee.invitee_name}</div>

                        {invitee.invitee_email ? (
                          <div style={mutedTextStyle()}>{invitee.invitee_email}</div>
                        ) : null}

                        {invitee.invitee_phone ? (
                          <div style={mutedTextStyle()}>{invitee.invitee_phone}</div>
                        ) : null}

                        {invitee.notes ? (
                          <div style={mutedTextStyle()}>{invitee.notes}</div>
                        ) : null}

                        <form action={removeExternalInviteeAction} style={{ marginTop: 12 }}>
                          <input type="hidden" name="invitee_id" value={invitee.id} />
                          <button type="submit" className="qv-link-button qv-button-secondary">
                            Remove
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {shouldShowVolunteerResponsesPanel ? (
              <section id="volunteer-detail" className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Volunteers</h2>
                    <p className="qv-section-subtitle">
                      {isSingleCouncil
                        ? 'Volunteer responses for this event.'
                        : 'Volunteers are grouped by invited group. The host can see volunteer names and contact info for all participating groups.'}
                    </p>
                  </div>

                  <div className="qv-directory-actions">
                    <Link
                      href={`/events/${event.id}/volunteers`}
                      className="qv-link-button qv-button-secondary"
                    >
                      View Volunteers
                    </Link>

                    <Link
                      href={`/events/${event.id}/export`}
                      className="qv-link-button qv-button-secondary"
                    >
                      Export CSV
                    </Link>
                  </div>
                </div>

                {!isDraft && isSingleCouncil ? (
                  personRsvps.length === 0 ? (
                    <div className="qv-empty">
                      <h3 className="qv-empty-title">No volunteers submitted yet</h3>
                      <p className="qv-empty-text">
                        Volunteer submissions will appear here after RSVP responses are submitted.
                      </p>
                    </div>
                  ) : (
                    <div className="qv-detail-stack">
                      {singleSummary.last_responded_at ? (
                        <div style={mutedTextStyle()}>
                          Last updated {formatDateTime(singleSummary.last_responded_at)}
                        </div>
                      ) : null}

                      {personRsvps.map((submission) => {
                        const attendees = personAttendeesByRsvpId.get(submission.id) ?? [];
                        const additionalAttendees = attendees.filter((attendee) => !attendee.is_primary);
                        const removeAction = removeVolunteerSubmission.bind(null, event.id, submission.id, 'detail');
                        const removalWarning =
                          submission.source_code === 'public_link'
                            ? 'This volunteer came in through the public RSVP page. Remove them only if you are sure they should no longer be listed for this event.'
                            : submission.source_code === 'email_link'
                              ? 'This volunteer responded from an email link. Remove them only if you are sure they should no longer be listed for this event.'
                              : 'This will remove the host-added volunteer from this event roster.';

                        return (
                          <div key={submission.id} className="qv-detail-item">
                            <div className="qv-detail-label">Volunteer submission</div>
                            <div className="qv-detail-value">{submission.primary_name}</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                              <span className="qv-badge">
                                {submission.source_code === 'host_manual'
                                  ? 'Host added'
                                  : submission.source_code === 'email_link'
                                    ? 'Email link'
                                    : 'Public link'}
                              </span>
                              {submission.claimed_at ? <span className="qv-badge qv-badge-soft">Claimed</span> : null}
                            </div>
                            <div style={mutedTextStyle()}>
                              {submission.primary_email || 'No Email'} • {submission.primary_phone || 'No phone #'}
                            </div>
                            <div style={mutedTextStyle()}>Updated {formatDateTime(submission.last_responded_at)}</div>
                            {submission.response_notes ? <div style={mutedTextStyle()}>Notes: {submission.response_notes}</div> : null}

                            {additionalAttendees.length > 0 ? (
                              <div style={volunteerListStyle()}>
                                {additionalAttendees.map((attendee) => (
                                  <div key={attendee.id} className="qv-detail-item" style={{ marginTop: 0 }}>
                                    <div className="qv-detail-label">{attendee.is_primary ? 'Primary volunteer' : 'Additional volunteer'}</div>
                                    <div className="qv-detail-value">{attendee.attendee_name}</div>
                                    <div style={mutedTextStyle()}>
                                      {(attendee.uses_primary_contact ? submission.primary_email || attendee.attendee_email : attendee.attendee_email) || 'No Email'}
                                      {' • '}
                                      {(attendee.uses_primary_contact ? submission.primary_phone || attendee.attendee_phone : attendee.attendee_phone) || 'No phone #'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            <div className="qv-form-actions" style={{ marginTop: 14 }}>
                              <RemoveVolunteerButton action={removeAction} warningText={removalWarning} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : rollups.length === 0 ? (
                  <div className="qv-empty">
                    <h3 className="qv-empty-title">No response rows yet</h3>
                    <p className="qv-empty-text">
                      Volunteer submissions will appear here after RSVP responses are submitted.
                    </p>
                  </div>
                ) : (
                  <div className="qv-detail-stack">
                    {rollups.map((rollup) => {
                      const rsvp = rsvpByInviteId.get(rollup.event_invited_council_id);
                      const rsvpId = rsvp?.id ?? rollup.event_council_rsvp_id ?? null;
                      const volunteerRows = rsvpId ? volunteersByRsvpId.get(rsvpId) ?? [] : [];

                      return (
                        <div key={rollup.event_invited_council_id} style={councilCardStyle()}>
                          <div className="qv-member-name">
                            {groupDisplayName(
                              rollup.invited_council_name,
                              rollup.invited_council_number
                            )}
                          </div>

                          <div style={mutedTextStyle()}>
                            {rollup.has_responded
                              ? `Responded • ${rollup.volunteer_count} volunteer${
                                  rollup.volunteer_count === 1 ? '' : 's'
                                }`
                              : 'No response yet'}
                          </div>

                          {rsvp?.responding_contact_name ? (
                            <div style={mutedTextStyle()}>
                              Contact: {rsvp.responding_contact_name}
                              {rsvp.responding_contact_email
                                ? ` • ${rsvp.responding_contact_email}`
                                : ''}
                              {rsvp.responding_contact_phone
                                ? ` • ${rsvp.responding_contact_phone}`
                                : ''}
                            </div>
                          ) : null}

                          {rsvp?.response_notes ? (
                            <div style={mutedTextStyle()}>Notes: {rsvp.response_notes}</div>
                          ) : null}

                          {volunteerRows.length === 0 ? (
                            !rollup.has_responded ? (
                              <div style={mutedTextStyle()}>Waiting for a submission.</div>
                            ) : null
                          ) : (
                            <div style={volunteerListStyle()}>
                              {volunteerRows.map((volunteer) => (
                                <div key={volunteer.id} className="qv-detail-item">
                                  <div className="qv-detail-label">Volunteer</div>
                                  <div className="qv-detail-value">{volunteer.volunteer_name}</div>

                                  {volunteer.volunteer_email ? (
                                    <div style={mutedTextStyle()}>{volunteer.volunteer_email}</div>
                                  ) : null}

                                  {volunteer.volunteer_phone ? (
                                    <div style={mutedTextStyle()}>{volunteer.volunteer_phone}</div>
                                  ) : null}

                                  {volunteer.volunteer_notes ? (
                                    <div style={mutedTextStyle()}>{volunteer.volunteer_notes}</div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}
            </div>
          ) : null}

          <div className="qv-detail-stack">
            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Overview</h2>
                </div>
              </div>

              <div className="qv-detail-list">
                {!isSingleCouncil ? (
                  <div className="qv-detail-item">
                    <div className="qv-detail-label">Host</div>
                    <div className="qv-detail-value">
                      {council.name ?? 'Council'}
                      {council.council_number ? ` (${council.council_number})` : ''}
                    </div>
                  </div>
                ) : null}

                <div className="qv-detail-item">
                  <div className="qv-detail-label">When</div>
                  <div className="qv-detail-value">
                    {formatDateTimeRange(event.starts_at, event.ends_at)}
                  </div>
                </div>

                <div className="qv-detail-item">
                  <div className="qv-detail-label">Location</div>
                  <div className="qv-detail-value">
                    {event.location_name || event.location_address
                      ? [event.location_name, event.location_address].filter(Boolean).join(' • ')
                      : '—'}
                  </div>
                </div>

                <div className="qv-detail-item">
                  <div className="qv-detail-label">RSVP</div>
                  <div className="qv-detail-value">
                    {event.requires_rsvp ? 'Required' : 'Not required'}
                  </div>
                </div>

                <div className="qv-detail-item">
                  <div className="qv-detail-label">RSVP deadline</div>
                  <div className="qv-detail-value">{formatDateTime(event.rsvp_deadline_at)}</div>
                </div>

                <div className="qv-detail-item">
                  <div className="qv-detail-label">Reminder email</div>
                  <div className="qv-detail-value">{event.reminder_enabled ? 'Enabled' : 'Off'}</div>
                </div>

                <div className="qv-detail-item">
                  <div className="qv-detail-label">Reminder send time</div>
                  <div className="qv-detail-value">
                    {formatDateTime(event.reminder_scheduled_for)}
                  </div>
                </div>
              </div>
            </section>

            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Message activity</h2>
                  <p className="qv-section-subtitle">
                    First-pass email queue visibility for invitations and reminders.
                  </p>
                </div>
              </div>

              {messageJobs.length === 0 ? (
                <div className="qv-empty">
                  <h3 className="qv-empty-title">No message jobs yet</h3>
                  <p className="qv-empty-text">
                    Invitation and reminder jobs will appear here after save logic runs.
                  </p>
                </div>
              ) : (
                <div className="qv-detail-list">
                  {messageJobs.map((job) => (
                    <div key={job.id} className="qv-detail-item">
                      <div className="qv-detail-label">
                        {getMessageTypeLabel(job.message_type_code)}
                      </div>
                      <div className="qv-detail-value">{job.recipient_email}</div>

                      <div style={mutedTextStyle()}>
                        {getMessageStatusLabel(job.status_code)} • Scheduled{' '}
                        {formatDateTime(job.scheduled_for)}
                      </div>

                      {job.sent_at ? (
                        <div style={mutedTextStyle()}>Sent {formatDateTime(job.sent_at)}</div>
                      ) : null}

                      {job.failed_at ? (
                        <div style={mutedTextStyle()}>Failed {formatDateTime(job.failed_at)}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}