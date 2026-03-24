import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import AppHeader from '@/app/app-header';
import RevokePersonRsvpButton from '@/app/rsvp/revoke-person-rsvp-button';
import { revokePersonRsvpByToken } from '@/app/events/actions';
import { claimPersonRsvpAction, saveClaimedPersonRsvpAction } from '../actions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { listClaimablePersonRsvps } from '@/lib/rsvp/claim';
import { loadPublicInviteContext } from '@/lib/rsvp/public';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ManagePageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submission?: string; saved?: string }>;
};

type AttendeeRow = {
  id: string;
  attendee_name: string;
  attendee_email: string | null;
  attendee_phone: string | null;
  uses_primary_contact: boolean;
  is_primary: boolean;
  sort_order: number;
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

  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} to ${dateFormatter.format(end)} ${timeFormatter.format(end)}`;
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

function buildAdditionalAttendeeSlots(existing: AttendeeRow[]) {
  const slots = [...existing];

  while (slots.length < 3) {
    slots.push({
      id: `new-${slots.length}`,
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

function reasonLabel(reason: string) {
  switch (reason) {
    case 'claimed':
      return 'Already secured';
    case 'submission':
      return 'Direct RSVP match';
    case 'primary_email':
      return 'Matched by RSVP email';
    case 'attendee_email':
      return 'Matched by attendee email';
    case 'matched_person':
      return 'Matched through your member record';
    default:
      return 'Match found';
  }
}

export default async function ManagePage({ params, searchParams }: ManagePageProps) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedSubmissionId =
    typeof resolvedSearchParams.submission === 'string' ? resolvedSearchParams.submission.trim() : '';
  const saved = resolvedSearchParams.saved === '1';

  const authSupabase = await createClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  const adminSupabase = createAdminClient();
  const context = await loadPublicInviteContext(adminSupabase, token);

  if (!context || context.event.scope_code !== 'home_council_only') {
    notFound();
  }

  if (!user) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <section className="qv-card">
            <p className="qv-eyebrow">Manage your RSVP</p>
            <h1 className="qv-section-title" style={{ fontSize: 32 }}>
              Confirm your email first
            </h1>
            <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
              Use the secure email link to sign in before managing this RSVP.
            </p>
            <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
              <Link
                href={`/rsvp/${token}/claim${requestedSubmissionId ? `?submission=${encodeURIComponent(requestedSubmissionId)}` : ''}`}
                className="qv-link-button qv-button-primary"
              >
                Confirm my email
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const candidates = await listClaimablePersonRsvps({
    supabase: adminSupabase,
    eventId: context.event.id,
    hostCouncilId: context.event.host_council_id,
    userId: user.id,
    email: user.email ?? null,
    submissionId: requestedSubmissionId || null,
  });

  if (candidates.length === 0) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <section className="qv-card">
            <p className="qv-eyebrow">Manage your RSVP</p>
            <h1 className="qv-section-title" style={{ fontSize: 32 }}>
              We could not find an RSVP yet
            </h1>
            <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
              We signed you in, but we could not match this email to an RSVP for this event. Try the email address used on the RSVP or ask the host to update your contact info first.
            </p>
            <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
              <Link href={`/rsvp/${token}`} className="qv-link-button qv-button-secondary">
                Back to RSVP
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const claimedCandidate =
    candidates.find((candidate) => candidate.id === requestedSubmissionId && candidate.claimed_by_user_id === user.id) ??
    candidates.find((candidate) => candidate.claimed_by_user_id === user.id) ??
    null;

  const selectedCandidate =
    claimedCandidate ??
    candidates.find((candidate) => candidate.id === requestedSubmissionId) ??
    candidates[0];

  const additionalAttendeeSlots = buildAdditionalAttendeeSlots(
    selectedCandidate.attendees.filter((attendee) => !attendee.is_primary)
  );

  const saveAction = saveClaimedPersonRsvpAction.bind(null, token, selectedCandidate.id);
  const claimAction = claimPersonRsvpAction.bind(null, token, selectedCandidate.id);
  const revokeAction = revokePersonRsvpByToken.bind(null, token, selectedCandidate.id);
  const renderedAt = new Date().valueOf();
  const deadlinePassed =
    !!context.event.rsvp_deadline_at && new Date(context.event.rsvp_deadline_at).getTime() < renderedAt;
  const isClaimedByCurrentUser = selectedCandidate.claimed_by_user_id === user.id;
  const isClaimedByAnotherUser =
    !!selectedCandidate.claimed_by_user_id && selectedCandidate.claimed_by_user_id !== user.id;

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Manage your RSVP</p>
          <h1 className="qv-title">{context.event.title}</h1>
          <p className="qv-subtitle">{formatDateTimeRange(context.event.starts_at, context.event.ends_at)}</p>
          <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
            Signed in as {user.email ?? 'your email address'}
          </p>
        </section>

        {saved ? (
          <section className="qv-card">
            <h2 className="qv-section-title">Changes saved</h2>
            <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
              Your RSVP is updated and secured to this email.
            </p>
          </section>
        ) : null}

        {candidates.length > 1 && !isClaimedByCurrentUser ? (
          <section className="qv-card">
            <h2 className="qv-section-title">We found a few possible matches</h2>
            <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
              Choose the RSVP you want to secure and manage.
            </p>

            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              {candidates.map((candidate) => {
                const candidateClaimAction = claimPersonRsvpAction.bind(null, token, candidate.id);
                const attendeeNames = candidate.attendees.filter((attendee) => !attendee.is_primary).map((attendee) => attendee.attendee_name);

                return (
                  <div key={candidate.id} style={cardInsetStyle()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <h3 className="qv-section-title" style={{ fontSize: 20 }}>
                          {candidate.primary_name}
                        </h3>
                        <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
                          {reasonLabel(candidate.claim_reason)} • Last updated {formatDateTime(candidate.last_responded_at)}
                        </p>
                        {candidate.primary_email ? (
                          <p style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{candidate.primary_email}</p>
                        ) : null}
                        {attendeeNames.length > 0 ? (
                          <p style={{ marginTop: 6, color: 'var(--text-secondary)' }}>
                            Includes: {attendeeNames.join(', ')}
                          </p>
                        ) : null}
                      </div>

                      {candidate.claimed_by_user_id === user.id ? (
                        <Link href={`/rsvp/${token}/manage?submission=${encodeURIComponent(candidate.id)}`} className="qv-link-button qv-button-secondary">
                          Open
                        </Link>
                      ) : candidate.claimed_by_user_id ? (
                        <span className="qv-badge">Already secured</span>
                      ) : (
                        <form action={candidateClaimAction}>
                          <button type="submit" className="qv-button-primary">
                            Secure this RSVP
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {isClaimedByAnotherUser ? (
          <section className="qv-card">
            <h2 className="qv-section-title">This RSVP is already secured</h2>
            <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
              This RSVP is already linked to another email sign-in. If that seems wrong, ask the host for help.
            </p>
          </section>
        ) : !isClaimedByCurrentUser ? (
          <section className="qv-card">
            <h2 className="qv-section-title">We found your RSVP</h2>
            <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
              Secure it to this email so you can come back later and manage it without a password.
            </p>
            <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
              <form action={claimAction}>
                <button type="submit" className="qv-button-primary">
                  Secure this RSVP
                </button>
              </form>
            </div>
          </section>
        ) : deadlinePassed ? (
          <section className="qv-card">
            <h2 className="qv-section-title">RSVP window has closed</h2>
            <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
              You can still review your secured RSVP here, but the deadline for edits has passed.
            </p>
          </section>
        ) : (
          <form action={saveAction} className="qv-form-grid">
            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Your details</h2>
                  <p className="qv-section-subtitle">
                    Keep your contact details current so the host can reach you if needed.
                  </p>
                </div>
              </div>

              <div className="qv-form-grid">
                <div className="qv-form-row qv-form-row-3">
                  <label className="qv-control">
                    <span className="qv-label">Your name</span>
                    <input type="text" name="primary_name" defaultValue={selectedCandidate.primary_name} required />
                  </label>

                  <label className="qv-control">
                    <span className="qv-label">Your email</span>
                    <input type="email" name="primary_email" defaultValue={selectedCandidate.primary_email ?? user.email ?? ''} required />
                  </label>

                  <label className="qv-control">
                    <span className="qv-label">Your phone</span>
                    <input type="text" name="primary_phone" defaultValue={selectedCandidate.primary_phone ?? ''} />
                  </label>
                </div>

                <div className="qv-form-row">
                  <label className="qv-control">
                    <span className="qv-label">Notes</span>
                    <textarea name="response_notes" defaultValue={selectedCandidate.response_notes ?? ''} placeholder="Optional note for the host." />
                  </label>
                </div>
              </div>
            </section>

            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Additional people on your RSVP</h2>
                  <p className="qv-section-subtitle">
                    Each additional person counts as one volunteer for this event.
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
                          <input type="text" name="attendee_name[]" defaultValue={attendee.attendee_name ?? ''} />
                        </label>

                        <label className="qv-control">
                          <span className="qv-label">Email</span>
                          <input type="email" name="attendee_email[]" defaultValue={attendee.attendee_email ?? ''} />
                        </label>

                        <label className="qv-control">
                          <span className="qv-label">Phone</span>
                          <input type="text" name="attendee_phone[]" defaultValue={attendee.attendee_phone ?? ''} />
                        </label>
                      </div>

                      <div className="qv-form-row">
                        <label className="qv-control" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                        <label className="qv-control" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="checkbox" name={`attendee_remove_${index}`} value="true" style={{ width: 'auto' }} />
                          <span className="qv-label" style={{ margin: 0 }}>
                            Remove this person from my RSVP
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="qv-card">
              <h2 className="qv-section-title">RSVP access</h2>
              <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
                Secured {selectedCandidate.claimed_at ? formatDateTime(selectedCandidate.claimed_at) : 'just now'}.
              </p>
              <p style={{ marginTop: 10, color: 'var(--text-secondary)' }}>
                Last updated {formatDateTime(selectedCandidate.last_responded_at)}.
              </p>
            </section>

            <div className="qv-form-actions">
              <Link href={`/rsvp/${token}`} className="qv-link-button qv-button-secondary">
                Back to RSVP
              </Link>
              <Link href="/me" className="qv-link-button qv-button-secondary">
                My secured RSVPs
              </Link>
              <RevokePersonRsvpButton action={revokeAction} />
              <button type="submit" className="qv-button-primary">
                Save changes
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
