import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import AppHeader from '@/app/app-header';
import CopyLinkPill from '../copy-link-pill';
import { formatEventDateTimeRange } from '@/lib/events/display'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PublicEventOverviewPageProps = {
  params: Promise<{
    token: string;
  }>;
};

type InviteRow = {
  id: string;
  event_id: string;
  invited_council_name: string;
  invited_council_number: string | null;
  invite_email: string | null;
  invite_contact_name: string | null;
  is_host: boolean;
  rsvp_link_token: string;
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  location_address: string | null;
  starts_at: string;
  ends_at: string | null;
  requires_rsvp: boolean;
  needs_volunteers: boolean;
  rsvp_deadline_at: string | null;
  status_code: string;
  scope_code: 'home_council_only' | 'multi_council';
};

type EventSummaryRow = {
  event_id: string;
  invited_council_count: number;
  responded_council_count: number;
  total_volunteer_count: number;
};

type EventPersonSummaryRow = {
  event_id: string;
  active_submission_count: number;
  total_volunteer_count: number;
  last_responded_at: string | null;
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
  event_invited_council_id: string;
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

type HostInviteRow = {
  invited_council_name: string;
  invited_council_number: string | null;
};

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

function buildInviteUrl(token: string) {
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}/rsvp/${token}` : `/rsvp/${token}`;
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

function groupDisplayName(name: string, number?: string | null) {
  return number ? `${name} (${number})` : name;
}

function mutedTextStyle(): CSSProperties {
  return {
    marginTop: 4,
    fontSize: 14,
    color: 'var(--text-secondary)',
    wordBreak: 'break-word',
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

function volunteerListStyle(): CSSProperties {
  return {
    display: 'grid',
    gap: 10,
    marginTop: 12,
  };
}

export default async function PublicEventOverviewPage({
  params,
}: PublicEventOverviewPageProps) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: inviteData, error: inviteError } = await supabase
    .from('event_invited_councils')
    .select(
      'id, event_id, invited_council_name, invited_council_number, invite_email, invite_contact_name, is_host, rsvp_link_token'
    )
    .eq('rsvp_link_token', token)
    .single();

  const invite = inviteData as InviteRow | null;

  if (inviteError || !invite) {
    notFound();
  }

  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select(
      'id, title, description, location_name, location_address, starts_at, ends_at, requires_rsvp, needs_volunteers, rsvp_deadline_at, status_code, scope_code'
    )
    .eq('id', invite.event_id)
    .single();

  const event = eventData as EventRow | null;

  if (eventError || !event) {
    notFound();
  }

  if (event.status_code !== 'scheduled') {
    notFound();
  }

  const isSingleCouncil = event.scope_code === 'home_council_only';

  let hostInvite: HostInviteRow | null = null;
  let ownRsvp: RsvpRow | null = null;
  let ownVolunteers: VolunteerRow[] = [];
  let summary: EventSummaryRow | null = null;
  let personSummary: EventPersonSummaryRow | null = null;
  let rollups: RollupRow[] = [];

  if (isSingleCouncil) {
    const [{ data: personSummaryRows, error: personSummaryError }] = await Promise.all([
      supabase
        .from('event_person_rsvp_summary')
        .select('event_id, active_submission_count, total_volunteer_count, last_responded_at')
        .eq('event_id', event.id)
        .returns<EventPersonSummaryRow[]>(),
    ]);

    if (personSummaryError) {
      return (
        <main className="qv-page">
          <div className="qv-shell">
            <AppHeader />
            <section className="qv-card qv-error">Could not load event overview.</section>
          </div>
        </main>
      );
    }

    personSummary = personSummaryRows?.[0] ?? {
      event_id: event.id,
      active_submission_count: 0,
      total_volunteer_count: 0,
      last_responded_at: null,
    };
  } else {
    const [
      { data: summaryRows, error: summaryError },
      { data: rollupsData, error: rollupsError },
      { data: ownRsvpData, error: ownRsvpError },
      { data: hostInviteData, error: hostInviteError },
    ] = await Promise.all([
      supabase
        .from('event_host_summary')
        .select('event_id, invited_council_count, responded_council_count, total_volunteer_count')
        .eq('event_id', event.id)
        .returns<EventSummaryRow[]>(),
      supabase
        .from('event_council_rsvp_rollups')
        .select(
          'event_id, event_invited_council_id, invited_council_name, invited_council_number, invite_email, is_host, has_responded, volunteer_count, last_responded_at, event_council_rsvp_id'
        )
        .eq('event_id', event.id)
        .returns<RollupRow[]>(),
      supabase
        .from('event_council_rsvps')
        .select('id, event_invited_council_id')
        .eq('event_invited_council_id', invite.id)
        .maybeSingle(),
      supabase
        .from('event_invited_councils')
        .select('invited_council_name, invited_council_number')
        .eq('event_id', event.id)
        .eq('is_host', true)
        .maybeSingle(),
    ]);

    if (summaryError || rollupsError || ownRsvpError || hostInviteError) {
      return (
        <main className="qv-page">
          <div className="qv-shell">
            <AppHeader />
            <section className="qv-card qv-error">Could not load event overview.</section>
          </div>
        </main>
      );
    }

    summary = summaryRows?.[0] ?? {
      event_id: event.id,
      invited_council_count: rollupsData?.length ?? 0,
      responded_council_count: (rollupsData ?? []).filter((row) => row.has_responded).length,
      total_volunteer_count: (rollupsData ?? []).reduce(
        (sum, row) => sum + (row.volunteer_count ?? 0),
        0
      ),
    };

    rollups = rollupsData ?? [];
    ownRsvp = (ownRsvpData as RsvpRow | null) ?? null;
    hostInvite = (hostInviteData as HostInviteRow | null) ?? null;

    if (ownRsvp?.id) {
      const { data: volunteerData, error: volunteerError } = await supabase
        .from('event_rsvp_volunteers')
        .select(
          'id, event_council_rsvp_id, volunteer_name, volunteer_email, volunteer_phone, volunteer_notes, sort_order'
        )
        .eq('event_council_rsvp_id', ownRsvp.id)
        .order('sort_order', { ascending: true })
        .returns<VolunteerRow[]>();

      if (volunteerError) {
        return (
          <main className="qv-page">
            <div className="qv-shell">
              <AppHeader />
              <section className="qv-card qv-error">Could not load volunteer detail.</section>
            </div>
          </main>
        );
      }

      ownVolunteers = volunteerData ?? [];
    }
  }

  const ownRollup =
    !isSingleCouncil
      ? rollups.find((row) => row.event_invited_council_id === invite.id) ?? null
      : null;

  const primaryActionLabel = isSingleCouncil
    ? 'Open RSVP'
    : ownRsvp
      ? 'Update RSVP'
      : 'RSVP now';

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">Event overview</p>
              <h1 className="qv-title">{event.title}</h1>
              <p className="qv-subtitle">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</p>

              {!isSingleCouncil ? (
                <div style={mutedTextStyle()}>
                  Host:{' '}
                  {hostInvite
                    ? groupDisplayName(
                        hostInvite.invited_council_name,
                        hostInvite.invited_council_number
                      )
                    : '—'}
                </div>
              ) : null}

              <div className="qv-detail-badges">
                <span className="qv-badge">
                  {event.requires_rsvp ? 'RSVP required' : 'Open event'}
                </span>
                <span className="qv-badge">
                  {event.needs_volunteers ? 'Volunteers needed' : 'No volunteers needed'}
                </span>

                {!isSingleCouncil ? (
                  <span className="qv-badge">
                    Your group: {groupDisplayName(invite.invited_council_name, invite.invited_council_number)}
                  </span>
                ) : (
                  <span className="qv-badge">Individual / household RSVP</span>
                )}

                <CopyLinkPill href={buildInviteUrl(token)} />
              </div>
            </div>

            <div className="qv-detail-actions">
              <Link href={`/rsvp/${token}`} className="qv-link-button qv-button-primary">
                {primaryActionLabel}
              </Link>
              {isSingleCouncil ? (
                <Link href={`/rsvp/${token}/manage`} className="qv-link-button qv-button-secondary">
                  Manage RSVP
                </Link>
              ) : null}
            </div>
          </div>

          {isSingleCouncil ? (
            <div className="qv-stats">
              <div className="qv-stat-card">
                <div className="qv-stat-number">{personSummary?.active_submission_count ?? 0}</div>
                <div className="qv-stat-label">Responses</div>
              </div>

              <div className="qv-stat-card">
                <div className="qv-stat-number">{personSummary?.total_volunteer_count ?? 0}</div>
                <div className="qv-stat-label">Total volunteers</div>
              </div>

              <div className="qv-stat-card">
                <div
                  className="qv-stat-number"
                  style={{ fontSize: 18, lineHeight: 1.2 }}
                >
                  {personSummary?.last_responded_at
                    ? formatDateTime(personSummary.last_responded_at)
                    : 'No responses yet'}
                </div>
                <div className="qv-stat-label">Last update</div>
              </div>
            </div>
          ) : (
            <div className="qv-stats">
              <div className="qv-stat-card">
                <div className="qv-stat-number">{summary?.invited_council_count ?? 0}</div>
                <div className="qv-stat-label">Invited groups</div>
              </div>

              <div className="qv-stat-card">
                <div className="qv-stat-number">{summary?.responded_council_count ?? 0}</div>
                <div className="qv-stat-label">Responded groups</div>
              </div>

              <div className="qv-stat-card">
                <div className="qv-stat-number">{summary?.total_volunteer_count ?? 0}</div>
                <div className="qv-stat-label">Total volunteers</div>
              </div>
            </div>
          )}

          {event.description?.trim() ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {event.description.trim()}
            </div>
          ) : null}
        </section>

        <div className="qv-detail-grid">
          <div className="qv-detail-stack">
            {isSingleCouncil ? (
              <section className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Participation</h2>
                    <p className="qv-section-subtitle">
                      Responses are counted across all submissions for this event. Names are managed inside each RSVP.
                    </p>
                  </div>
                </div>

                <div className="qv-detail-list">
                  <div className="qv-detail-item">
                    <div className="qv-detail-label">Responses</div>
                    <div className="qv-detail-value">{personSummary?.active_submission_count ?? 0}</div>
                  </div>

                  <div className="qv-detail-item">
                    <div className="qv-detail-label">Total volunteers</div>
                    <div className="qv-detail-value">{personSummary?.total_volunteer_count ?? 0}</div>
                  </div>

                  <div className="qv-detail-item">
                    <div className="qv-detail-label">Last update</div>
                    <div className="qv-detail-value">
                      {formatDateTime(personSummary?.last_responded_at)}
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Participating groups</h2>
                    <p className="qv-section-subtitle">
                      Volunteer counts are visible across groups. Volunteer names are only visible for your own group.
                    </p>
                  </div>
                </div>

                {rollups.length === 0 ? (
                  <div className="qv-empty">
                    <h3 className="qv-empty-title">No group data yet</h3>
                    <p className="qv-empty-text">
                      Participation will appear here as responses come in.
                    </p>
                  </div>
                ) : (
                  <div className="qv-detail-stack">
                    {rollups.map((row) => {
                      const isOwnCouncil = row.event_invited_council_id === invite.id;

                      return (
                        <div key={row.event_invited_council_id} style={councilCardStyle()}>
                          <div className="qv-member-name">
                            {groupDisplayName(row.invited_council_name, row.invited_council_number)}
                          </div>

                          <div style={mutedTextStyle()}>
                            {row.has_responded ? 'Responded' : 'Not responded yet'}
                            {' • '}
                            {row.volunteer_count} volunteer{row.volunteer_count === 1 ? '' : 's'}
                          </div>

                          {row.last_responded_at ? (
                            <div style={mutedTextStyle()}>
                              Updated {formatDateTime(row.last_responded_at)}
                            </div>
                          ) : null}

                          {isOwnCouncil && ownVolunteers.length > 0 ? (
                            <div style={volunteerListStyle()}>
                              {ownVolunteers.map((volunteer) => (
                                <div key={volunteer.id} className="qv-detail-item">
                                  <div className="qv-detail-value">{volunteer.volunteer_name}</div>
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
            )}
          </div>

          <div className="qv-detail-stack">
            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Event details</h2>
                </div>
              </div>

              <div className="qv-detail-list">
                <div className="qv-detail-item">
                  <div className="qv-detail-label">When</div>
                  <div className="qv-detail-value">
                    {formatEventDateTimeRange(event.starts_at, event.ends_at)}
                  </div>
                </div>

                <div className="qv-detail-item">
                  <div className="qv-detail-label">Location name</div>
                  <div className="qv-detail-value">{event.location_name || '—'}</div>
                </div>

                <div className="qv-detail-item">
                  <div className="qv-detail-label">Address</div>
                  <div className="qv-detail-value">{event.location_address || '—'}</div>
                </div>

                <div className="qv-detail-item">
                  <div className="qv-detail-label">RSVP deadline</div>
                  <div className="qv-detail-value">{formatDateTime(event.rsvp_deadline_at)}</div>
                </div>

                {!isSingleCouncil ? (
                  <div className="qv-detail-item">
                    <div className="qv-detail-label">Your response</div>
                    <div className="qv-detail-value">
                      {ownRollup?.has_responded
                        ? `Responded • ${ownRollup.volunteer_count} volunteer${
                            ownRollup.volunteer_count === 1 ? '' : 's'
                          }`
                        : 'Not responded yet'}
                    </div>
                  </div>
                ) : (
                  <div className="qv-detail-item">
                    <div className="qv-detail-label">Response type</div>
                    <div className="qv-detail-value">Individual / household RSVP</div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}