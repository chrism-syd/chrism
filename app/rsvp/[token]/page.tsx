import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import AppHeader from '@/app/app-header';
import {
  revokePersonRsvpByToken,
  submitCouncilRsvpByToken,
} from '@/app/events/actions';
import RevokePersonRsvpButton from '@/app/rsvp/revoke-person-rsvp-button';
import { formatEventDateTimeRange } from '@/lib/events/display'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PublicRsvpPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    saved?: string;
    revoked?: string;
    submission?: string;
    flow?: string;
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
  scope_code: 'home_council_only' | 'multi_council';
  requires_rsvp: boolean;
  needs_volunteers: boolean;
  rsvp_deadline_at: string | null;
  status_code: string;
};

type RsvpRow = {
  id: string;
  event_invited_council_id: string;
  responding_council_name: string;
  responding_council_number: string | null;
  responding_contact_name: string | null;
  responding_contact_email: string | null;
  responding_contact_phone: string | null;
  response_notes: string | null;
  last_responded_at: string;
};

type VolunteerRow = {
  id: string;
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

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
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

function currentIsoTimestamp() {
  return new Date().toISOString();
}

function buildVolunteerSlots(existing: VolunteerRow[]) {
  const slots = [...existing];

  while (slots.length < 3) {
    slots.push({
      id: `new-${slots.length}`,
      volunteer_name: '',
      volunteer_email: '',
      volunteer_phone: '',
      volunteer_notes: '',
      sort_order: slots.length,
    });
  }

  return slots;
}

function buildAdditionalAttendeeSlots(existing: EventPersonRsvpAttendeeRow[]) {
  const slots = [...existing];

  while (slots.length < 3) {
    slots.push({
      id: `new-${slots.length}`,
      event_person_rsvp_id: '',
      matched_person_id: null,
      attendee_name: '',
      attendee_email: '',
      attendee_phone: '',
      uses_primary_contact: true,
      is_primary: false,
      sort_order: slots.length + 1,
    });
  }

  return slots;
}

function cardInsetStyle(): CSSProperties {
  return {
    border: '1px solid var(--divider)',
    borderRadius: 16,
    padding: 16,
    background: 'var(--bg-sunken)',
  };
}

function smallNoteStyle(): CSSProperties {
  return {
    margin: '6px 0 0',
    fontSize: 13,
    color: 'var(--text-secondary)',
  };
}

export default async function PublicRsvpPage({
  params,
  searchParams,
}: PublicRsvpPageProps) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const saved = resolvedSearchParams.saved === '1';
  const revoked = resolvedSearchParams.revoked === '1';
  const submissionId =
    typeof resolvedSearchParams.submission === 'string'
      ? resolvedSearchParams.submission.trim()
      : '';

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
      'id, title, description, location_name, location_address, starts_at, ends_at, scope_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, status_code'
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

  let rsvp: RsvpRow | null = null;
  let volunteers: VolunteerRow[] = [];
  let personRsvp: EventPersonRsvpRow | null = null;
  let personAttendees: EventPersonRsvpAttendeeRow[] = [];

  if (isSingleCouncil) {
    if (submissionId) {
      const { data: personRsvpData } = await supabase
        .from('event_person_rsvps')
        .select(
          'id, event_id, matched_person_id, claimed_by_user_id, primary_name, primary_email, primary_phone, response_notes, source_code, status_code, first_responded_at, last_responded_at, claimed_at, cancelled_at'
        )
        .eq('id', submissionId)
        .eq('event_id', event.id)
        .eq('status_code', 'active')
        .maybeSingle();

      personRsvp = (personRsvpData as EventPersonRsvpRow | null) ?? null;
    } else {
      const inviteEmail = normalizeEmail(invite.invite_email);

      if (inviteEmail) {
        const { data: personRsvpData } = await supabase
          .from('event_person_rsvps')
          .select(
            'id, event_id, matched_person_id, claimed_by_user_id, primary_name, primary_email, primary_phone, response_notes, source_code, status_code, first_responded_at, last_responded_at, claimed_at, cancelled_at'
          )
          .eq('event_id', event.id)
          .eq('primary_email', inviteEmail)
          .eq('status_code', 'active')
          .maybeSingle();

        personRsvp = (personRsvpData as EventPersonRsvpRow | null) ?? null;
      }
    }

    if (personRsvp?.id) {
      const { data: attendeeRows } = await supabase
        .from('event_person_rsvp_attendees')
        .select(
          'id, event_person_rsvp_id, matched_person_id, attendee_name, attendee_email, attendee_phone, uses_primary_contact, is_primary, sort_order'
        )
        .eq('event_person_rsvp_id', personRsvp.id)
        .order('sort_order', { ascending: true })
        .returns<EventPersonRsvpAttendeeRow[]>();

      personAttendees = attendeeRows ?? [];
    }
  } else {
    const { data: rsvpData } = await supabase
      .from('event_council_rsvps')
      .select(
        'id, event_invited_council_id, responding_council_name, responding_council_number, responding_contact_name, responding_contact_email, responding_contact_phone, response_notes, last_responded_at'
      )
      .eq('event_invited_council_id', invite.id)
      .maybeSingle();

    rsvp = (rsvpData as RsvpRow | null) ?? null;

    if (rsvp?.id) {
      const { data: volunteerRows } = await supabase
        .from('event_rsvp_volunteers')
        .select('id, volunteer_name, volunteer_email, volunteer_phone, volunteer_notes, sort_order')
        .eq('event_council_rsvp_id', rsvp.id)
        .order('sort_order', { ascending: true })
        .returns<VolunteerRow[]>();

      volunteers = volunteerRows ?? [];
    }
  }

  const volunteerSlots = buildVolunteerSlots(volunteers);
  const primaryAttendee = personAttendees.find((row) => row.is_primary) ?? null;
  const additionalAttendeeSlots = buildAdditionalAttendeeSlots(
    personAttendees.filter((row) => !row.is_primary)
  );

  const deadlinePassed =
    !!event.rsvp_deadline_at && event.rsvp_deadline_at < currentIsoTimestamp();

  const lastUpdatedLabel = isSingleCouncil
    ? personRsvp
      ? formatDateTime(personRsvp.last_responded_at)
      : 'Not yet submitted'
    : rsvp
      ? formatDateTime(rsvp.last_responded_at)
      : 'Not yet submitted';

  const revokeAction =
    isSingleCouncil && personRsvp?.id
      ? revokePersonRsvpByToken.bind(null, token, personRsvp.id)
      : null;
  const manageHref = isSingleCouncil
    ? `/rsvp/${token}/${personRsvp?.claimed_by_user_id ? 'manage' : 'claim'}${personRsvp?.id ? `?submission=${encodeURIComponent(personRsvp.id)}` : ''}`
    : null;

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">{isSingleCouncil ? 'Volunteer RSVP' : 'Event RSVP'}</p>
              <h1 className="qv-title">{event.title}</h1>
              <p className="qv-subtitle">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                <span className="qv-badge">
                  {event.requires_rsvp ? 'RSVP required' : 'Open event'}
                </span>
                <span className="qv-badge">
                  {event.needs_volunteers ? 'Volunteers needed' : 'No volunteers needed'}
                </span>
                <span className="qv-badge">
                  {isSingleCouncil
                    ? 'Individual RSVP'
                    : invite.is_host
                      ? 'Host council link'
                      : 'Council invite link'}
                </span>
                <span className="qv-badge">
                  {deadlinePassed
                    ? 'RSVP closed'
                    : event.rsvp_deadline_at
                      ? `Deadline ${formatDateTime(event.rsvp_deadline_at)}`
                      : 'No RSVP deadline'}
                </span>
              </div>
            </div>
          </div>

          <div className="qv-stats">
            <div className="qv-stat-card">
              <div className="qv-stat-label">{isSingleCouncil ? 'Hosted by' : 'Invited council'}</div>
              <div className="qv-stat-number" style={{ fontSize: 20, lineHeight: 1.2 }}>
                {invite.invited_council_name}
              </div>
              {invite.invited_council_number ? (
                <div className="qv-stat-label">
                  {isSingleCouncil
                    ? invite.invited_council_number
                    : `Council ${invite.invited_council_number}`}
                </div>
              ) : null}
            </div>

            <div className="qv-stat-card">
              <div className="qv-stat-label">Location</div>
              <div className="qv-stat-number" style={{ fontSize: 18, lineHeight: 1.2 }}>
                {event.location_name || 'TBD'}
              </div>
              {event.location_address ? (
                <div className="qv-stat-label">{event.location_address}</div>
              ) : null}
            </div>

            <div className="qv-stat-card">
              <div className="qv-stat-label">Last update</div>
              <div className="qv-stat-number" style={{ fontSize: 18, lineHeight: 1.2 }}>
                {lastUpdatedLabel}
              </div>
              <div className="qv-stat-label">You can reuse this same link to update your response.</div>
            </div>
          </div>

          {event.description?.trim() ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {event.description.trim()}
            </div>
          ) : null}
        </section>

        {isSingleCouncil ? (
          <section className="qv-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h2 className="qv-section-title">Manage your RSVP later</h2>
                <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
                  Confirm your email to secure this RSVP and come back later without relying on this link alone.
                </p>
              </div>

              {manageHref ? (
                <Link href={manageHref} className="qv-link-button qv-button-secondary">
                  {personRsvp?.claimed_by_user_id ? 'Manage your RSVP' : 'Confirm your email'}
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {saved ? (
          <section className="qv-card">
            <div>
              <h2 className="qv-section-title">RSVP saved</h2>
              <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
                {isSingleCouncil
                  ? 'Your RSVP has been saved. Use this same link to update it later.'
                  : 'Your RSVP has been saved. You can reuse this same link to update your response.'}
              </p>

              {isSingleCouncil && personRsvp?.last_responded_at ? (
                <p style={{ marginTop: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                  Saved {formatDateTime(personRsvp.last_responded_at)}
                </p>
              ) : null}

              {!isSingleCouncil && rsvp?.last_responded_at ? (
                <p style={{ marginTop: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                  Saved {formatDateTime(rsvp.last_responded_at)}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {revoked ? (
          <section className="qv-card">
            <div>
              <h2 className="qv-section-title">RSVP removed</h2>
              <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
                Your RSVP has been removed from this event. You can submit again with this same link if needed.
              </p>
            </div>
          </section>
        ) : null}

        {deadlinePassed ? (
          <section className="qv-card">
            <div className="qv-empty">
              <h2 className="qv-empty-title">RSVP window has closed</h2>
              <p className="qv-empty-text">
                This RSVP link is no longer accepting updates because the deadline has passed.
              </p>

              {isSingleCouncil && personRsvp ? (
                <p className="qv-empty-text">
                  Your last submitted response was saved on {formatDateTime(personRsvp.last_responded_at)}.
                </p>
              ) : null}

              {!isSingleCouncil && rsvp ? (
                <p className="qv-empty-text">
                  Your last submitted response was saved on {formatDateTime(rsvp.last_responded_at)}.
                </p>
              ) : null}
            </div>
          </section>
        ) : isSingleCouncil ? (
          <form action={submitCouncilRsvpByToken} className="qv-form-grid">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="rsvp_flow" value="person" />

            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Your RSVP</h2>
                  <p className="qv-section-subtitle">
                    RSVP for yourself here. You can also add family members or friends in the next section.
                  </p>
                </div>
              </div>

              <div className="qv-form-grid">
                <div className="qv-form-row qv-form-row-3">
                  <label className="qv-control">
                    <span className="qv-label">Your name</span>
                    <input
                      type="text"
                      name="primary_name"
                      defaultValue={
                        personRsvp?.primary_name ??
                        primaryAttendee?.attendee_name ??
                        invite.invite_contact_name ??
                        ''
                      }
                      required
                    />
                  </label>

                  <label className="qv-control">
                    <span className="qv-label">Your email</span>
                    <input
                      type="email"
                      name="primary_email"
                      defaultValue={personRsvp?.primary_email ?? invite.invite_email ?? ''}
                      required
                    />
                  </label>

                  <label className="qv-control">
                    <span className="qv-label">Your phone</span>
                    <input
                      type="text"
                      name="primary_phone"
                      defaultValue={personRsvp?.primary_phone ?? primaryAttendee?.attendee_phone ?? ''}
                    />
                  </label>
                </div>

                <div className="qv-form-row">
                  <label className="qv-control">
                    <span className="qv-label">Notes</span>
                    <textarea
                      name="response_notes"
                      defaultValue={personRsvp?.response_notes ?? ''}
                      placeholder="Optional note for the host."
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Additional people coming with you</h2>
                  <p className="qv-section-subtitle">
                    Add anyone else you are bringing. Each person added counts as one volunteer.
                  </p>
                </div>
              </div>

              <div className="qv-form-grid">
                {additionalAttendeeSlots.map((attendee, index) => (
                  <div key={attendee.id} style={cardInsetStyle()}>
                    <div className="qv-directory-section-head">
                      <div>
                        <h3 className="qv-section-title" style={{ fontSize: 18 }}>
                          Additional person {index + 1}
                        </h3>
                        <p className="qv-section-subtitle">Leave blank if you do not need this row.</p>
                      </div>
                    </div>

                    <div className="qv-form-grid">
                      <div className="qv-form-row qv-form-row-3">
                        <label className="qv-control">
                          <span className="qv-label">Name</span>
                          <input
                            type="text"
                            name="attendee_name[]"
                            defaultValue={attendee.attendee_name ?? ''}
                          />
                        </label>

                        <label className="qv-control">
                          <span className="qv-label">Email</span>
                          <input
                            type="email"
                            name="attendee_email[]"
                            defaultValue={attendee.attendee_email ?? ''}
                          />
                        </label>

                        <label className="qv-control">
                          <span className="qv-label">Phone</span>
                          <input
                            type="text"
                            name="attendee_phone[]"
                            defaultValue={attendee.attendee_phone ?? ''}
                          />
                        </label>
                      </div>

                      <div className="qv-form-row">
                        <label
                          className="qv-control"
                          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <input
                            type="checkbox"
                            name={`attendee_use_primary_contact_${index}`}
                            value="true"
                            defaultChecked={attendee.uses_primary_contact}
                            style={{ width: 'auto' }}
                          />
                          <span className="qv-label" style={{ margin: 0 }}>
                            Use my email and phone for this person
                          </span>
                        </label>
                      </div>

                      <div className="qv-form-row">
                        <label
                          className="qv-control"
                          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <input
                            type="checkbox"
                            name={`attendee_remove_${index}`}
                            value="true"
                            style={{ width: 'auto' }}
                          />
                          <span className="qv-label" style={{ margin: 0 }}>
                            Remove this person from my RSVP
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p style={smallNoteStyle()}>
                This first pass renders three additional-person rows by default. Blank rows are ignored.
              </p>
            </section>

            <div className="qv-form-actions">
              <Link href={`/rsvp/${token}/event`} className="qv-link-button qv-button-secondary">
                Back to Event
              </Link>

              {revokeAction ? <RevokePersonRsvpButton action={revokeAction} /> : null}

              <button type="submit" className="qv-button-primary">
                {personRsvp ? 'Update RSVP' : 'Submit RSVP'}
              </button>
            </div>
          </form>
        ) : (
          <form action={submitCouncilRsvpByToken} className="qv-form-grid">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="rsvp_flow" value="council" />

            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Council response</h2>
                  <p className="qv-section-subtitle">
                    Submit your council name, number, contact details, and volunteer list. This is one
                    shared RSVP link for your council.
                  </p>
                </div>
              </div>

              <div className="qv-form-grid">
                <div className="qv-form-row qv-form-row-2">
                  <label className="qv-control">
                    <span className="qv-label">Council name</span>
                    <input
                      type="text"
                      name="responding_council_name"
                      defaultValue={rsvp?.responding_council_name ?? invite.invited_council_name}
                      required
                    />
                  </label>

                  <label className="qv-control">
                    <span className="qv-label">Council number</span>
                    <input
                      type="text"
                      name="responding_council_number"
                      defaultValue={
                        rsvp?.responding_council_number ?? invite.invited_council_number ?? ''
                      }
                    />
                  </label>
                </div>

                <div className="qv-form-row qv-form-row-3">
                  <label className="qv-control">
                    <span className="qv-label">Contact name</span>
                    <input
                      type="text"
                      name="responding_contact_name"
                      defaultValue={rsvp?.responding_contact_name ?? invite.invite_contact_name ?? ''}
                    />
                  </label>

                  <label className="qv-control">
                    <span className="qv-label">Contact email</span>
                    <input
                      type="email"
                      name="responding_contact_email"
                      defaultValue={rsvp?.responding_contact_email ?? invite.invite_email ?? ''}
                    />
                  </label>

                  <label className="qv-control">
                    <span className="qv-label">Contact phone</span>
                    <input
                      type="text"
                      name="responding_contact_phone"
                      defaultValue={rsvp?.responding_contact_phone ?? ''}
                    />
                  </label>
                </div>

                <div className="qv-form-row">
                  <label className="qv-control">
                    <span className="qv-label">Response notes</span>
                    <textarea
                      name="response_notes"
                      defaultValue={rsvp?.response_notes ?? ''}
                      placeholder="Optional notes for the host council."
                    />
                  </label>
                </div>
              </div>
            </section>

            {event.needs_volunteers ? (
              <section className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Volunteers</h2>
                    <p className="qv-section-subtitle">
                      Add the volunteers your council expects to send. In v1 this is a flat list, not role
                      slots. External volunteers remain event-scoped only.
                    </p>
                  </div>
                </div>

                <div className="qv-form-grid">
                  {volunteerSlots.map((volunteer, index) => (
                    <div key={volunteer.id} style={cardInsetStyle()}>
                    <div className="qv-directory-section-head">
                      <div>
                        <h3 className="qv-section-title" style={{ fontSize: 18 }}>
                          Volunteer {index + 1}
                        </h3>
                        <p className="qv-section-subtitle">Leave blank if you do not need this row.</p>
                      </div>
                    </div>

                    <div className="qv-form-grid">
                      <div className="qv-form-row qv-form-row-3">
                        <label className="qv-control">
                          <span className="qv-label">Volunteer name</span>
                          <input
                            type="text"
                            name="volunteer_name[]"
                            defaultValue={volunteer.volunteer_name ?? ''}
                          />
                        </label>

                        <label className="qv-control">
                          <span className="qv-label">Volunteer email</span>
                          <input
                            type="email"
                            name="volunteer_email[]"
                            defaultValue={volunteer.volunteer_email ?? ''}
                          />
                        </label>

                        <label className="qv-control">
                          <span className="qv-label">Volunteer phone</span>
                          <input
                            type="text"
                            name="volunteer_phone[]"
                            defaultValue={volunteer.volunteer_phone ?? ''}
                          />
                        </label>
                      </div>

                      <div className="qv-form-row">
                        <label className="qv-control">
                          <span className="qv-label">Volunteer notes</span>
                          <input
                            type="text"
                            name="volunteer_notes[]"
                            defaultValue={volunteer.volunteer_notes ?? ''}
                            placeholder="Optional note"
                          />
                        </label>
                      </div>

                      <div className="qv-form-row">
                        <label
                          className="qv-control"
                          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <input
                            type="checkbox"
                            name={`volunteer_remove_${index}`}
                            value="true"
                            style={{ width: 'auto' }}
                          />
                          <span className="qv-label" style={{ margin: 0 }}>
                            Remove this volunteer from the RSVP
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

                <p style={smallNoteStyle()}>
                  This first pass renders three volunteer rows by default. Save logic ignores blank rows.
                </p>
              </section>
            ) : null}

            <div className="qv-form-actions">
              <Link href={`/rsvp/${token}/event`} className="qv-link-button qv-button-secondary">
                Back to Event
              </Link>

              <button type="submit" className="qv-button-primary">
                {rsvp ? 'Update RSVP' : 'Submit RSVP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}