import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { getCurrentActingCouncilContextForEvent } from '@/lib/auth/acting-context';
import AppHeader from '@/app/app-header';
import {
  removeVolunteerSubmission,
  updateHostManualVolunteer,
} from '@/app/events/actions';
import RemoveVolunteerButton from '@/app/events/remove-volunteer-button';
import { formatEventDateTimeRange } from '@/lib/events/display'

type VolunteersPageProps = {
  params: Promise<{ id: string }>;
};

type OrganizationRow = {
  id: string;
  name: string | null;
};

type EventRow = {
  id: string;
  council_id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  location_address: string | null;
  starts_at: string;
  ends_at: string | null;
  scope_code: 'home_council_only' | 'multi_council';
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting';
  requires_rsvp: boolean;
  rsvp_deadline_at: string | null;
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

type RollupRow = {
  event_id: string;
  event_invited_council_id: string;
  invited_council_name: string;
  invited_council_number: string | null;
  has_responded: boolean;
  volunteer_count: number;
  event_council_rsvp_id: string | null;
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

function mutedTextStyle(): CSSProperties {
  return {
    marginTop: 4,
    fontSize: 14,
    color: 'var(--text-secondary)',
    wordBreak: 'break-word',
  };
}

function cardStyle(): CSSProperties {
  return {
    border: '1px solid var(--divider)',
    borderRadius: 16,
    padding: 16,
    background: 'var(--bg-sunken)',
  };
}

function attendeeListStyle(): CSSProperties {
  return {
    display: 'grid',
    gap: 10,
    marginTop: 12,
  };
}

function sourceLabel(sourceCode: EventPersonRsvpRow['source_code']) {
  if (sourceCode === 'host_manual') return 'Host added';
  if (sourceCode === 'email_link') return 'Email link';
  return 'Public link';
}

function groupDisplayName(name: string, number?: string | null) {
  return number ? `${name} (${number})` : name;
}

export default async function EventVolunteersPage({ params }: VolunteersPageProps) {
  const { id } = await params;
  const { admin: supabase, council } = await getCurrentActingCouncilContextForEvent({
    eventId: id,
    redirectTo: '/events',
  });

  let organization: OrganizationRow | null = null;

  if (council.organization_id) {
    const { data } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', council.organization_id)
      .single();

    organization = (data as OrganizationRow | null) ?? null;
  }

  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select(
      'id, council_id, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, rsvp_deadline_at'
    )
    .eq('id', id)
    .eq('council_id', council.id)
    .single();

  const event = eventData as EventRow | null;

  if (eventError || !event) {
    notFound();
  }

  const isSingleCouncil = event.scope_code === 'home_council_only';

  if (event.event_kind_code !== 'standard') {
    redirect(`/events/${event.id}`);
  }

  if (isSingleCouncil) {
    const [
      { data: summaryData, error: summaryError },
      { data: rsvpData, error: rsvpError },
    ] = await Promise.all([
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
    ]);

    if (summaryError || rsvpError) {
      return (
        <main className="qv-page">
          <div className="qv-shell">
            <AppHeader />
            <section className="qv-card qv-error">Could not load volunteer roster.</section>
          </div>
        </main>
      );
    }

    const submissions = rsvpData ?? [];
    const summary = summaryData?.[0] ?? {
      event_id: event.id,
      active_submission_count: submissions.length,
      total_volunteer_count: 0,
      last_responded_at: null,
    };

    let attendees: EventPersonRsvpAttendeeRow[] = [];

    if (submissions.length > 0) {
      const { data: attendeeData, error: attendeeError } = await supabase
        .from('event_person_rsvp_attendees')
        .select(
          'id, event_person_rsvp_id, matched_person_id, attendee_name, attendee_email, attendee_phone, uses_primary_contact, is_primary, sort_order'
        )
        .in(
          'event_person_rsvp_id',
          submissions.map((row) => row.id)
        )
        .order('sort_order', { ascending: true })
        .returns<EventPersonRsvpAttendeeRow[]>();

      if (attendeeError) {
        return (
          <main className="qv-page">
            <div className="qv-shell">
              <AppHeader />
              <section className="qv-card qv-error">Could not load attendee rows.</section>
            </div>
          </main>
        );
      }

      attendees = attendeeData ?? [];
    }

    const attendeesBySubmissionId = new Map<string, EventPersonRsvpAttendeeRow[]>();

    for (const attendee of attendees) {
      const existing = attendeesBySubmissionId.get(attendee.event_person_rsvp_id) ?? [];
      existing.push(attendee);
      attendeesBySubmissionId.set(attendee.event_person_rsvp_id, existing);
    }

    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />

          <section className="qv-hero-card">
            <div className="qv-hero-top">
              <div>
                <p className="qv-eyebrow">
                  {organization?.name ? `${organization.name} • ` : ''}
                  {council.name ?? 'Council'}
                  {council.council_number ? ` (${council.council_number})` : ''}
                </p>

                <h1 className="qv-title">Volunteer roster</h1>
                <p className="qv-subtitle">{event.title}</p>
                <div style={mutedTextStyle()}>
                  {formatEventDateTimeRange(event.starts_at, event.ends_at)}
                </div>
              </div>

              <div className="qv-detail-actions">
                <Link href={`/events/${event.id}`} className="qv-link-button qv-button-secondary">
                  Back to event
                </Link>
                <Link
                  href={`/events/${event.id}/export`}
                  className="qv-link-button qv-button-secondary"
                >
                  Export CSV
                </Link>
              </div>
            </div>

            <div className="qv-stats">
              <div className="qv-stat-card">
                <div className="qv-stat-number">{summary.total_volunteer_count}</div>
                <div className="qv-stat-label">Total volunteers</div>
              </div>

              <div className="qv-stat-card">
                <div className="qv-stat-number">{summary.active_submission_count}</div>
                <div className="qv-stat-label">Responses</div>
              </div>

              <div className="qv-stat-card">
                <div className="qv-stat-number">
                  {summary.last_responded_at ? formatDateTime(summary.last_responded_at) : '—'}
                </div>
                <div className="qv-stat-label">Last update</div>
              </div>
            </div>
          </section>

          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">All volunteers</h2>
                <p className="qv-section-subtitle">
                  Review volunteer submissions, edit host-added entries, or remove any active volunteer.
                </p>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="qv-empty">
                <h3 className="qv-empty-title">No volunteers yet</h3>
                <p className="qv-empty-text">
                  Volunteer submissions will appear here once people RSVP.
                </p>
              </div>
            ) : (
              <div className="qv-detail-stack">
                {submissions.map((submission) => {
                  const submissionAttendees = (attendeesBySubmissionId.get(submission.id) ?? []).filter((attendee) => !attendee.is_primary);
                  const updateAction = updateHostManualVolunteer.bind(null, event.id, submission.id);
                  const removeAction = removeVolunteerSubmission.bind(null, event.id, submission.id, 'volunteers');
                  const removalWarning =
                    submission.source_code === 'public_link'
                      ? 'This volunteer came in through the public RSVP page. Remove them only if you are sure they should no longer be listed for this event.'
                      : submission.source_code === 'email_link'
                        ? 'This volunteer responded from an email link. Remove them only if you are sure they should no longer be listed for this event.'
                        : 'This will remove the host-added volunteer from this event roster.';

                  return (
                    <div key={submission.id} style={cardStyle()}>
                      <div className="qv-member-name">{submission.primary_name}</div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        <span className="qv-badge">{sourceLabel(submission.source_code)}</span>
                        {submission.claimed_at ? <span className="qv-badge">Claimed</span> : null}
                      </div>

                      <div style={mutedTextStyle()}>
                        {submission.primary_email || 'No Email'}
                        {' • '}
                        {submission.primary_phone || 'No phone #'}
                      </div>

                      <div style={mutedTextStyle()}>
                        Updated {formatDateTime(submission.last_responded_at)}
                      </div>

                      {submission.response_notes ? (
                        <div style={mutedTextStyle()}>Notes: {submission.response_notes}</div>
                      ) : null}

                      {submissionAttendees.length > 0 ? (
                        <div style={attendeeListStyle()}>
                          {submissionAttendees.map((attendee) => (
                            <div key={attendee.id} className="qv-detail-item">
                              <div className="qv-detail-label">
                                {attendee.is_primary ? 'Primary volunteer' : 'Additional volunteer'}
                              </div>
                              <div className="qv-detail-value">{attendee.attendee_name}</div>
                              <div style={mutedTextStyle()}>
                                {attendee.uses_primary_contact
                                  ? submission.primary_email || attendee.attendee_email || 'No Email'
                                  : attendee.attendee_email || 'No Email'}
                                {' • '}
                                {attendee.uses_primary_contact
                                  ? submission.primary_phone || attendee.attendee_phone || 'No phone #'
                                  : attendee.attendee_phone || 'No phone #'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {submission.source_code === 'host_manual' ? (
                        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                          <details>
                            <summary
                              style={{
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              Edit host-added volunteer
                            </summary>

                            <form action={updateAction} className="qv-form-grid" style={{ marginTop: 12 }}>
                              <div className="qv-form-row qv-form-row-3">
                                <label className="qv-control">
                                  <span className="qv-label">Volunteer name</span>
                                  <input
                                    type="text"
                                    name="primary_name"
                                    defaultValue={submission.primary_name}
                                    required
                                  />
                                </label>

                                <label className="qv-control">
                                  <span className="qv-label">Volunteer email</span>
                                  <input
                                    type="email"
                                    name="primary_email"
                                    defaultValue={submission.primary_email ?? ''}
                                    placeholder="Optional"
                                  />
                                </label>

                                <label className="qv-control">
                                  <span className="qv-label">Volunteer phone</span>
                                  <input
                                    type="text"
                                    name="primary_phone"
                                    defaultValue={submission.primary_phone ?? ''}
                                    placeholder="Optional"
                                  />
                                </label>
                              </div>

                              <div className="qv-form-row">
                                <label className="qv-control">
                                  <span className="qv-label">Notes</span>
                                  <textarea
                                    name="response_notes"
                                    defaultValue={submission.response_notes ?? ''}
                                    placeholder="Optional host note"
                                  />
                                </label>
                              </div>

                              <div className="qv-form-actions">
                                <button type="submit" className="qv-button-primary">
                                  Save changes
                                </button>
                              </div>
                            </form>
                          </details>

                          <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
                            <RemoveVolunteerButton action={removeAction} warningText={removalWarning} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  const [
    { data: rollupData, error: rollupError },
    { data: rsvpData, error: rsvpError },
    { data: volunteerData, error: volunteerError },
  ] = await Promise.all([
    supabase
      .from('event_council_rsvp_rollups')
      .select(
        'event_id, event_invited_council_id, invited_council_name, invited_council_number, has_responded, volunteer_count, event_council_rsvp_id'
      )
      .eq('event_id', event.id)
      .returns<RollupRow[]>(),
    supabase
      .from('event_council_rsvps')
      .select(
        'id, event_invited_council_id, responding_contact_name, responding_contact_email, responding_contact_phone, response_notes, last_responded_at'
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
  ]);

  if (rollupError || rsvpError || volunteerError) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <section className="qv-card qv-error">Could not load volunteer roster.</section>
        </div>
      </main>
    );
  }

  const rollups = rollupData ?? [];
  const rsvps = rsvpData ?? [];
  const volunteers = volunteerData ?? [];

  const rsvpByInviteId = new Map(rsvps.map((row) => [row.event_invited_council_id, row]));
  const volunteersByRsvpId = new Map<string, VolunteerRow[]>();

  for (const volunteer of volunteers) {
    const existing = volunteersByRsvpId.get(volunteer.event_council_rsvp_id) ?? [];
    existing.push(volunteer);
    volunteersByRsvpId.set(volunteer.event_council_rsvp_id, existing);
  }

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">
                {organization?.name ? `${organization.name} • ` : ''}
                {council.name ?? 'Council'}
                {council.council_number ? ` (${council.council_number})` : ''}
              </p>

              <h1 className="qv-title">Volunteer roster</h1>
              <p className="qv-subtitle">{event.title}</p>
              <div style={mutedTextStyle()}>
                {formatEventDateTimeRange(event.starts_at, event.ends_at)}
              </div>
            </div>

            <div className="qv-detail-actions">
              <Link href={`/events/${event.id}`} className="qv-link-button qv-button-secondary">
                Back to event
              </Link>
              <Link
                href={`/events/${event.id}/export`}
                className="qv-link-button qv-button-secondary"
              >
                Export CSV
              </Link>
            </div>
          </div>
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">All volunteers</h2>
              <p className="qv-section-subtitle">
                Volunteers grouped by invited group.
              </p>
            </div>
          </div>

          {rollups.length === 0 ? (
            <div className="qv-empty">
              <h3 className="qv-empty-title">No responses yet</h3>
              <p className="qv-empty-text">
                Volunteer submissions will appear here once invited groups respond.
              </p>
            </div>
          ) : (
            <div className="qv-detail-stack">
              {rollups.map((rollup) => {
                const rsvp = rsvpByInviteId.get(rollup.event_invited_council_id);
                const volunteerRows = rollup.event_council_rsvp_id
                  ? volunteersByRsvpId.get(rollup.event_council_rsvp_id) ?? []
                  : [];

                return (
                  <div key={rollup.event_invited_council_id} style={cardStyle()}>
                    <div className="qv-member-name">
                      {groupDisplayName(rollup.invited_council_name, rollup.invited_council_number)}
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
                        {rsvp.responding_contact_email ? ` • ${rsvp.responding_contact_email}` : ''}
                        {rsvp.responding_contact_phone ? ` • ${rsvp.responding_contact_phone}` : ''}
                      </div>
                    ) : null}

                    {volunteerRows.length > 0 ? (
                      <div style={attendeeListStyle()}>
                        {volunteerRows.map((volunteer) => (
                          <div key={volunteer.id} className="qv-detail-item">
                            <div className="qv-detail-label">Volunteer</div>
                            <div className="qv-detail-value">{volunteer.volunteer_name}</div>
                            <div style={mutedTextStyle()}>
                              {volunteer.volunteer_email || 'No Email'}
                              {' • '}
                              {volunteer.volunteer_phone || 'No phone #'}
                            </div>
                            {volunteer.volunteer_notes ? (
                              <div style={mutedTextStyle()}>{volunteer.volunteer_notes}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}